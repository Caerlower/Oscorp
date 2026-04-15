from __future__ import annotations

import json
import re
import time

from openai import BadRequestError
from openai import AsyncOpenAI

from oscorp_agent.api_client import OscorpAPIClient
from oscorp_agent.config import Settings, resolve_llm_api_key
from oscorp_agent.gtm_tools import create_campaign_brief, draft_social_post
from oscorp_agent.payments.x402_signer import build_x402_payment_header
from oscorp_agent.x_tools import publish_x_post

_openai_client: AsyncOpenAI | None = None
_recent_post_fingerprints: dict[str, float] = {}


def get_openai_client(api_key: str, base_url: str) -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return _openai_client


def _compact_state(oscorp_state: dict) -> dict:
    gs = oscorp_state.get("globalState", {}) if isinstance(oscorp_state, dict) else {}
    if not isinstance(gs, dict):
        gs = {}
    return {
        "appId": oscorp_state.get("appId"),
        "name": gs.get("oscorpName"),
        "category": gs.get("category"),
        "gtmBudgetUsdc": gs.get("gtmBudgetUsdc"),
        "approvalThresholdUsdc": gs.get("approvalThresholdUsdc"),
        "minPatronPulse": gs.get("minPatronPulse"),
        "creator": gs.get("creator") or oscorp_state.get("creator"),
        "pulseAsset": gs.get("pulseAsset"),
        "usdcAsset": gs.get("usdcAsset"),
    }


def _post_fingerprint(text: str) -> str:
    # Normalize basic formatting differences so cosmetic variants are treated as duplicates.
    normalized = re.sub(r"\s+", " ", text.strip().lower())
    return normalized


def _cleanup_old_fingerprints(now_ts: float, window_seconds: int) -> None:
    expired = [
        fp for fp, ts in _recent_post_fingerprints.items() if (now_ts - ts) > max(1, window_seconds)
    ]
    for fp in expired:
        _recent_post_fingerprints.pop(fp, None)


def _is_duplicate_post(text: str, window_seconds: int) -> bool:
    now_ts = time.time()
    _cleanup_old_fingerprints(now_ts, window_seconds)
    fingerprint = _post_fingerprint(text)
    return fingerprint in _recent_post_fingerprints


def _mark_post_seen(text: str) -> None:
    _recent_post_fingerprints[_post_fingerprint(text)] = time.time()


async def run_agent_cycle(
    settings: Settings,
    api: OscorpAPIClient,
    oscorp_state: dict,
    recent_actions: list[str] | None = None,
) -> str:
    """
    Phase 1 loop:
    - Reuses the same OpenAI-driven planning style as the original runtime,
      but keeps execution read-only until tool migration is complete.
    """
    api_key = resolve_llm_api_key(settings)
    client = get_openai_client(api_key, settings.openai_base_url)

    compact_state = _compact_state(oscorp_state)
    prompt = (
        "You are the Oscorp Prime Agent. You can propose and execute operations with tools. "
        "When calling tools, emit valid tool-calls only (never XML/function tags in plain text). "
        "Prefer small safe updates and always report actions via report_activity. "
        f"Recent actions to avoid repeating verbatim: {recent_actions or []}"
    )

    if settings.agent_mode == "plan_only":
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are the Oscorp Prime Agent. Provide one concise next GTM action only. "
                        "Do not call tools. Avoid repeating previous actions."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Oscorp state: {compact_state}\n"
                        f"Recent actions: {recent_actions or []}\n"
                        "Return exactly 2-4 sentences with concrete next step."
                    ),
                },
            ],
        )
        return response.choices[0].message.content or "No action generated."

    tools = [
        {
            "type": "function",
            "function": {
                "name": "update_policy",
                "description": "Update Oscorp policy thresholds.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "approval_threshold_usdc": {"type": "integer"},
                        "gtm_budget_usdc": {"type": "integer"},
                        "min_patron_pulse": {"type": "integer"},
                    },
                    "required": ["approval_threshold_usdc", "gtm_budget_usdc", "min_patron_pulse"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "post_to_x",
                "description": "Post content to X using configured posting mode.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                    },
                    "required": ["text"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "report_activity",
                "description": "Report an agent activity/event to Oscorp backend.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "content": {"type": "string"},
                        "channel": {"type": "string"},
                    },
                    "required": ["type", "content"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_campaign_brief",
                "description": "Create a GTM campaign brief for this cycle.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "objective": {"type": "string"},
                        "channel": {"type": "string"},
                        "budget_usdc": {"type": "integer"},
                        "audience": {"type": "string"},
                        "cta": {"type": "string"},
                    },
                    "required": ["objective", "channel", "budget_usdc"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "draft_social_post",
                "description": "Draft a social post for X or LinkedIn.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string"},
                        "product_name": {"type": "string"},
                        "key_benefit": {"type": "string"},
                        "cta": {"type": "string"},
                    },
                    "required": ["channel", "product_name", "key_benefit", "cta"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "register_service",
                "description": "Register this Oscorp's paid service in marketplace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "service_name": {"type": "string"},
                        "description": {"type": "string"},
                        "price_micro_usdc": {"type": "integer"},
                        "provider_address": {"type": "string"},
                    },
                    "required": ["service_name", "description", "price_micro_usdc", "provider_address"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "discover_services",
                "description": "List available marketplace services.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "purchase_service",
                "description": "Purchase a provider service via x402-lite flow.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "provider_app_id": {"type": "integer"},
                        "payload_note": {"type": "string"},
                    },
                    "required": ["provider_app_id"],
                },
            },
        },
    ]

    messages: list[dict] = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"Oscorp state: {compact_state}"},
    ]
    tool_trace: list[str] = []

    for _ in range(max(1, settings.max_iterations)):
        try:
            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=messages,
                tools=tools,
                tool_choice="auto",
            )
        except BadRequestError as exc:
            # Some providers occasionally return malformed tool-call syntax.
            # Do not crash the scheduler; fallback to text-only action.
            fallback = await client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {
                        "role": "system",
                        "content": "Return one concise next GTM action sentence. Do not call tools.",
                    },
                    {"role": "user", "content": f"Oscorp state: {compact_state}"},
                ],
                tool_choice="none",
            )
            fallback_text = fallback.choices[0].message.content or "fallback_no_action"
            await api.report_activity(
                type_="llm_tool_fallback",
                content=fallback_text[:5000],
                channel="agent",
            )
            return f"llm_tool_call_error_recovered={exc} | fallback={fallback_text}"
        msg = response.choices[0].message

        if not msg.tool_calls:
            final_text = msg.content or "No action generated."
            if tool_trace:
                return f"{' | '.join(tool_trace)} | final={final_text}"
            return final_text

        assistant_msg: dict = {
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [],
        }
        for tc in msg.tool_calls:
            assistant_msg["tool_calls"].append(
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
            )
        messages.append(assistant_msg)

        for tc in msg.tool_calls:
            fn = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result: object
            if fn == "update_policy":
                result = await api.update_policy(
                    approval_threshold_usdc=int(args.get("approval_threshold_usdc", 10)),
                    gtm_budget_usdc=int(args.get("gtm_budget_usdc", 200)),
                    min_patron_pulse=int(args.get("min_patron_pulse", 100)),
                )
            elif fn == "report_activity":
                result = await api.report_activity(
                    type_=str(args.get("type", "agent")),
                    content=str(args.get("content", "Cycle action executed")),
                    channel=str(args.get("channel", "agent")),
                )
            elif fn == "create_campaign_brief":
                result = await create_campaign_brief(
                    objective=str(args.get("objective", "Increase qualified leads")),
                    channel=str(args.get("channel", "X")),
                    budget_usdc=int(args.get("budget_usdc", 50)),
                    audience=str(args.get("audience", "Founders and growth teams")),
                    cta=str(args.get("cta", "Book a demo")),
                )
            elif fn == "draft_social_post":
                result = await draft_social_post(
                    channel=str(args.get("channel", "X")),
                    product_name=str(args.get("product_name", "Oscorp")),
                    key_benefit=str(args.get("key_benefit", "ship GTM experiments faster")),
                    cta=str(args.get("cta", "Try it today")),
                )
            elif fn == "register_service":
                result = await api.register_service(
                    service_name=str(args.get("service_name", "GTM Sprint Strategy")),
                    description=str(args.get("description", "Deliver a 3-day GTM sprint playbook.")),
                    price_micro_usdc=int(args.get("price_micro_usdc", 50_000)),
                    provider_address=str(args.get("provider_address", oscorp_state.get("creator", ""))),
                )
            elif fn == "discover_services":
                result = await api.list_services()
            elif fn == "purchase_service":
                provider_app_id = int(args.get("provider_app_id", 0))
                quote_status, quote = await api.get_service_quote(provider_app_id)
                if quote_status != 402 or not quote:
                    result = {"error": "quote_failed", "status": quote_status, "quote": quote}
                else:
                    amount = int(quote.get("accepts", {}).get("amountMicroUsdc", 0))
                    pay_to = str(quote.get("accepts", {}).get("payTo", ""))
                    pay_status, pay_result = await api.x402_pay(to=pay_to, amount_micro_usdc=amount)
                    if pay_status not in (200, 201) or not pay_result:
                        result = {"error": "pay_failed", "status": pay_status, "pay_result": pay_result}
                    else:
                        tx_id = str(pay_result.get("payment", {}).get("txId", ""))
                        header = build_x402_payment_header(
                            payer_app_id=int(oscorp_state.get("appId", 0)),
                            amount_micro_usdc=amount,
                            tx_id=tx_id,
                        )
                        buy_status, buy_result = await api.purchase_service(
                            provider_app_id=provider_app_id,
                            payment_header=header,
                            payload={"note": str(args.get("payload_note", "Agent purchase"))},
                        )
                        result = {"buy_status": buy_status, "buy_result": buy_result, "tx_id": tx_id}
            elif fn == "post_to_x":
                text = str(args.get("text", "Oscorp update: shipping GTM experiments this week."))
                if _is_duplicate_post(text, settings.x_dedup_window_seconds):
                    result = {
                        "status": "duplicate_skipped",
                        "message": "Duplicate post detected. Skipping post and skipping payment.",
                        "queued_text": text,
                    }
                    tool_trace.append(f"{fn}={result}")
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": json.dumps(result, default=str),
                        }
                    )
                    continue
                if settings.x_execution_mode == "queue_only":
                    provider_app_id = int(oscorp_state.get("appId", 0))
                    quote_status, quote = await api.get_service_quote(provider_app_id)
                    if quote_status != 402 or not quote:
                        provider_address = str(
                            oscorp_state.get("globalState", {}).get("creator")
                            or oscorp_state.get("creator", "")
                        )
                        await api.register_service(
                            service_name="X Post Queue Service",
                            description="Queue GTM posts for X publishing once access is available",
                            price_micro_usdc=int(settings.x_queue_fee_micro_usdc),
                            provider_address=provider_address,
                        )
                        quote_status, quote = await api.get_service_quote(provider_app_id)

                    payment_info: dict = {"status": "not_executed"}
                    if quote_status == 402 and quote:
                        amount = int(
                            quote.get("accepts", {}).get("amountMicroUsdc", settings.x_queue_fee_micro_usdc)
                        )
                        pay_to = str(quote.get("accepts", {}).get("payTo", ""))
                        pay_status, pay_result = await api.x402_pay(to=pay_to, amount_micro_usdc=amount)
                        if pay_status in (200, 201) and pay_result:
                            tx_id = str(pay_result.get("payment", {}).get("txId", ""))
                            header = build_x402_payment_header(
                                payer_app_id=int(oscorp_state.get("appId", 0)),
                                amount_micro_usdc=amount,
                                tx_id=tx_id,
                            )
                            buy_status, buy_result = await api.purchase_service(
                                provider_app_id=provider_app_id,
                                payment_header=header,
                                payload={"queued_post": text},
                            )
                            payment_info = {
                                "pay_status": pay_status,
                                "buy_status": buy_status,
                                "tx_id": tx_id,
                                "purchase": buy_result,
                            }
                        else:
                            payment_info = {
                                "pay_status": pay_status,
                                "pay_result": pay_result,
                            }

                    result = {
                        "status": "queued_for_x_access",
                        "message": "Will post this on X once posting access/session is available.",
                        "queued_text": text,
                        "x402": payment_info,
                    }
                    if payment_info.get("tx_id"):
                        _mark_post_seen(text)
                else:
                    result = await publish_x_post(
                        settings=settings,
                        text=text,
                    )
                    if isinstance(result, dict) and result.get("status") == "posted":
                        _mark_post_seen(text)
            else:
                result = {"error": f"unsupported_tool:{fn}"}

            tool_trace.append(f"{fn}={result}")
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, default=str),
                }
            )

    return " | ".join(tool_trace) if tool_trace else "No action generated."
