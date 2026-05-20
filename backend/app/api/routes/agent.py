from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config.settings import settings
from app.providers.client import ProviderUnavailableError
from app.services.algorand import (
    build_algo_payment_txn,
    build_usdc_funding_txns,
    ensure_agent_usdc_ready,
    get_agent_balances,
    can_run_growth_cycle,
    is_agent_funded,
    prepare_agent_usdc_optin,
)
from app.services.wallet_address import normalize_wallet_address
from app.services.draft_payload import draft_to_api
from app.services.growth_cycle import run_growth_cycle_for_user
from app.services.growth_research import research_health
from app.services.regenerate import regenerate_draft_for_user
from app.services.telegram_notify import send_cycle_briefing, send_draft_with_actions
from app.store.memory import store

router = APIRouter(prefix="/api/agent", tags=["agent"])


class RunCycleRequest(BaseModel):
    user_id: str


class RegenerateDraftRequest(BaseModel):
    user_id: str
    draft_id: str
    feedback: str = Field(default="", max_length=500)


class BuildFundTxnsRequest(BaseModel):
    wallet_address: str = Field(..., min_length=10)


class FundInfoResponse(BaseModel):
    agent_address: str
    usdc_asset_id: int
    min_fund_micro_usdc: int
    current_usdc_micro: int
    usdc_opted_in: bool
    algo_micro: int
    funded: bool
    note: str


@router.get("/stack-health")
async def stack_health() -> dict:
    """Check x402-payer + provider services before run-cycle."""
    import httpx as hx

    checks: dict[str, dict] = {}
    async with hx.AsyncClient(timeout=5.0) as client:
        for name, url in [
            ("x402_payer", f"{settings.x402_payer_url.rstrip('/')}/health"),
            ("trend_analyzer", f"{settings.trend_analyzer_url.rstrip('/')}/health"),
            ("hook_generator", f"{settings.hook_generator_url.rstrip('/')}/health"),
        ]:
            try:
                r = await client.get(url)
                checks[name] = {"ok": r.status_code == 200, "status": r.status_code}
            except hx.ConnectError:
                checks[name] = {"ok": False, "status": "unreachable"}

    ready = all(c.get("ok") for c in checks.values())
    return {
        "ready": ready,
        "checks": checks,
        "hint": None
        if ready
        else "Start: x402-payer (:8110), trend-analyzer (:8101), hook-generator (:8102). Or OSCORP_PROVIDER_STUB=true.",
    }


@router.get("/research/status")
async def research_status() -> dict:
    return research_health()


@router.get("/fund-info/{user_id}", response_model=FundInfoResponse)
async def fund_info(user_id: str) -> FundInfoResponse:
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.policy:
        raise HTTPException(status_code=400, detail="Sign your growth policy first")
    balances = get_agent_balances(user.agent_address)
    min_fund = user.spend_cap_micro_usdc
    opted = bool(balances["usdc_opted_in"])
    algo_micro = int(balances["algo_micro"])
    cycle_ready = can_run_growth_cycle(balances)
    usdc_micro = int(balances["usdc_micro"])
    if opted and cycle_ready:
        if usdc_micro >= min_fund:
            note = "Agent is funded. Run a growth cycle or add more USDC."
        else:
            note = (
                f"Agent has ${usdc_micro / 1_000_000:.2f} USDC — enough to run cycles. "
                f"Top up toward your ${min_fund / 1_000_000:.2f} spend cap anytime."
            )
    elif opted:
        note = "Agent is opted into USDC. Click Fund agent to add USDC for provider payments."
    else:
        note = (
            "Fund agent uses two wallet approvals: (1) send 1 ALGO to the agent, "
            "(2) transfer USDC. Oscorp opts the agent into USDC between those steps."
        )
    return FundInfoResponse(
        agent_address=user.agent_address,
        usdc_asset_id=settings.usdc_asset_id,
        min_fund_micro_usdc=min_fund,
        current_usdc_micro=int(balances["usdc_micro"]),
        usdc_opted_in=opted,
        algo_micro=int(balances["algo_micro"]),
        funded=cycle_ready,
        note=note,
    )


def _resolve_user_wallet(user, wallet_address: str) -> str:
    try:
        user_address = normalize_wallet_address(wallet_address)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid wallet address") from exc
    if user_address != user.wallet_address:
        raise HTTPException(
            status_code=400,
            detail="Connected wallet does not match your Oscorp session",
        )
    return user_address


@router.post("/fund-step1-algo/{user_id}")
async def fund_step1_algo(user_id: str, req: BuildFundTxnsRequest) -> dict:
    """Wallet popup 1: send up to 1 ALGO to the agent wallet."""
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.policy:
        raise HTTPException(status_code=400, detail="Sign your growth policy first")
    user_address = _resolve_user_wallet(user, req.wallet_address)

    payload = build_algo_payment_txn(
        user_address=user_address,
        agent_address=user.agent_address,
    )
    if payload is None:
        return {
            "ok": True,
            "skip": True,
            "message": "Agent already has enough ALGO — continue to USDC transfer.",
            "agent_address": user.agent_address,
        }
    return {
        "ok": True,
        "skip": False,
        "agent_address": user.agent_address,
        "transaction": payload["transaction"],
        "algo_micro": payload["algo_micro"],
    }


@router.post("/fund-step2-agent-ready/{user_id}")
async def fund_step2_agent_ready(user_id: str) -> dict:
    """After ALGO payment: opt agent into USDC (server-signed, no wallet popup)."""
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        result = prepare_agent_usdc_optin(user.agent_address, user.agent_mnemonic)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": True,
        "usdc_opted_in": bool(result["usdc_opted_in"]),
        "algo_micro": int(result["algo_micro"]),
        "optin_tx": result.get("optin_tx"),
    }


@router.post("/fund-step3-usdc/{user_id}")
async def fund_step3_usdc(user_id: str, req: BuildFundTxnsRequest) -> dict:
    """Wallet popup 2: USDC opt-in (if needed) + transfer to agent."""
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.policy:
        raise HTTPException(status_code=400, detail="Sign your growth policy first")
    user_address = _resolve_user_wallet(user, req.wallet_address)

    balances = get_agent_balances(user.agent_address)
    min_fund = user.spend_cap_micro_usdc
    usdc_amount = max(min_fund - int(balances["usdc_micro"]), min_fund)

    try:
        group = build_usdc_funding_txns(
            user_address=user_address,
            agent_address=user.agent_address,
            usdc_amount_micro=usdc_amount,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return {
        "ok": True,
        "agent_address": user.agent_address,
        "usdc_amount_micro": usdc_amount,
        **group,
    }


@router.post("/ensure-usdc-optin/{user_id}")
async def ensure_usdc_optin(user_id: str) -> dict:
    """Opt agent into USDC ASA (signed by agent). Call before funding USDC."""
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    balances = get_agent_balances(user.agent_address)
    if balances["usdc_opted_in"]:
        return {
            "ok": True,
            "already_opted_in": True,
            "usdc_opted_in": True,
            "algo_micro": int(balances["algo_micro"]),
            "bootstrap_tx": None,
            "optin_tx": None,
        }
    try:
        result = ensure_agent_usdc_ready(user.agent_address, user.agent_mnemonic)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": True,
        "already_opted_in": False,
        "usdc_opted_in": bool(result["usdc_opted_in"]),
        "algo_micro": int(result["algo_micro"]),
        "bootstrap_tx": result.get("bootstrap_tx"),
        "optin_tx": result.get("optin_tx"),
    }


@router.post("/run-cycle")
async def run_cycle(req: RunCycleRequest) -> dict:
    user = store.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        out = await run_growth_cycle_for_user(user)
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except httpx.ConnectError as e:
        raise HTTPException(
            status_code=503,
            detail=(
                "Cannot reach x402-payer or provider services. "
                "Start x402-payer (:8110) and provider-services (:8101–8103), "
                "or set OSCORP_PROVIDER_STUB=true in backend/.env."
            ),
        ) from e
    except ValueError as e:
        if "funding" in str(e).lower():
            raise HTTPException(status_code=402, detail=str(e)) from e
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    record = out["record"]
    result = out["result"]
    payment_txs = out["payment_txs"]

    if user.telegram_chat_id:
        await send_cycle_briefing(
            chat_id=user.telegram_chat_id,
            trends=result.get("trends", {}),
            x_research=result.get("x_research", {}),
        )
        await send_draft_with_actions(
            chat_id=user.telegram_chat_id,
            draft_id=record.id,
            content=record.content,
            reasoning=record.reasoning,
            intent_url=record.intent_url,
            provider_outputs=record.provider_outputs,
            payment_txs=payment_txs,
            category=record.category,
        )

    return {
        "ok": True,
        "telegram_notified": user.telegram_chat_id is not None,
        "draft": draft_to_api(record, agent_address=user.agent_address),
        "briefing": {
            "account": result.get("account"),
            "trends": result.get("trends"),
            "x_research": result.get("x_research"),
            "strategy": result.get("strategy"),
        },
        "x402": {"payment_txs": payment_txs},
        "telegram_memory": {
            "summary": user.telegram_memory.summary,
            "preferences": user.telegram_memory.preferences,
        },
    }


@router.post("/regenerate-draft")
async def regenerate_draft(req: RegenerateDraftRequest) -> dict:
    user = store.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        record = await regenerate_draft_for_user(
            user, req.draft_id, feedback=req.feedback
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    if user.telegram_chat_id:
        await send_draft_with_actions(
            chat_id=user.telegram_chat_id,
            draft_id=record.id,
            content=record.content,
            reasoning=record.reasoning,
            intent_url=record.intent_url,
            provider_outputs=record.provider_outputs,
            payment_txs=record.payment_txs,
            category=record.category,
        )

    return {
        "ok": True,
        "draft": draft_to_api(record, agent_address=user.agent_address),
    }
