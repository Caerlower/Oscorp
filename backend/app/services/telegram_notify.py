from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config.settings import settings
from app.services.payment_receipt import payment_breakdown
from app.services.telegram_format import (
    escape_html,
    format_cycle_briefing_html,
    format_draft_message_html,
    format_draft_message_plain,
    format_no_charge_html,
    format_receipt_telegram_html,
    format_receipt_telegram_plain,
)

logger = logging.getLogger(__name__)

PARSE_MODE_HTML = "HTML"

_TX_BUTTON_LABELS: dict[str, str] = {
    "trends": "↗ Trend tx",
    "hooks": "↗ Hook tx",
    "thread": "↗ Thread tx",
}


async def send_message(
    *,
    chat_id: int,
    text: str,
    reply_markup: dict | None = None,
    parse_mode: str | None = PARSE_MODE_HTML,
    plain_fallback: str | None = None,
) -> bool:
    if not settings.telegram_bot_token:
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"

    async def _post(message_text: str, mode: str | None) -> httpx.Response:
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": message_text,
            "disable_web_page_preview": False,
        }
        if mode:
            payload["parse_mode"] = mode
        if reply_markup:
            payload["reply_markup"] = reply_markup
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.post(url, json=payload)

    r = await _post(text, parse_mode)
    if r.is_success:
        return True

    if parse_mode and plain_fallback:
        logger.warning(
            "Telegram HTML send failed (%s), retrying plain text with Lora URLs: %s",
            r.status_code,
            r.text[:300],
        )
        r2 = await _post(plain_fallback, None)
        return r2.is_success

    logger.error("Telegram send failed: %s %s", r.status_code, r.text[:500])
    return False


def draft_action_keyboard(
    *,
    draft_id: str,
    intent_url: str,
    provider_outputs: dict[str, Any] | None = None,
    payment_txs: list[str] | None = None,
) -> dict:
    keyboard: list[list[dict[str, str]]] = [
        [{"text": "𝕏 Post on X", "url": intent_url}],
    ]

    lines = payment_breakdown(provider_outputs, payment_txs)
    tx_buttons: list[dict[str, str]] = []
    for row in lines:
        url = row.get("explorer_url")
        if not url:
            continue
        provider = str(row.get("provider") or "")
        label = _TX_BUTTON_LABELS.get(provider, "↗ View tx")
        tx_buttons.append({"text": label, "url": url})
    if tx_buttons:
        keyboard.append(tx_buttons[:3])

    keyboard.append(
        [
            {"text": "✨ New draft", "callback_data": "nw:run"},
            {"text": "🔄 Regenerate", "callback_data": f"rg:{draft_id}"},
        ],
    )
    keyboard.append([{"text": "Skip", "callback_data": f"sk:{draft_id}"}])
    return {"inline_keyboard": keyboard}


async def send_draft_with_actions(
    *,
    chat_id: int,
    draft_id: str,
    content: str,
    reasoning: str,
    intent_url: str,
    provider_outputs: dict[str, Any] | None,
    payment_txs: list[str],
    category: str | None = None,
) -> bool:
    html = format_draft_message_html(
        content=content,
        reasoning=reasoning,
        provider_outputs=provider_outputs,
        payment_txs=payment_txs,
        draft_id=draft_id,
        category=category,
    )
    plain = format_draft_message_plain(
        content=content,
        reasoning=reasoning,
        provider_outputs=provider_outputs,
        payment_txs=payment_txs,
        draft_id=draft_id,
        category=category,
    )
    markup = draft_action_keyboard(
        draft_id=draft_id,
        intent_url=intent_url,
        provider_outputs=provider_outputs,
        payment_txs=payment_txs,
    )
    return await send_message(
        chat_id=chat_id,
        text=html,
        plain_fallback=plain,
        reply_markup=markup,
    )


async def send_draft_preview(
    *,
    chat_id: int,
    content: str,
    reasoning: str,
    intent_url: str,
    payment_txs: list[str],
    draft_id: str = "",
    provider_outputs: dict[str, Any] | None = None,
    category: str | None = None,
) -> bool:
    """Legacy wrapper — prefer send_draft_with_actions when draft_id is known."""
    if draft_id:
        return await send_draft_with_actions(
            chat_id=chat_id,
            draft_id=draft_id,
            content=content,
            reasoning=reasoning,
            intent_url=intent_url,
            provider_outputs=provider_outputs,
            payment_txs=payment_txs,
            category=category,
        )
    receipt_html = format_receipt_telegram_html(provider_outputs, payment_txs)
    receipt_plain = format_receipt_telegram_plain(provider_outputs, payment_txs)
    receipt_block = receipt_html if receipt_html else format_no_charge_html()
    receipt_plain_block = receipt_plain if receipt_plain else "No new x402 charges."
    text = (
        "<b>📝 New draft</b>\n\n"
        f"{escape_html(content)}\n\n"
        f"<b>Why</b>\n{escape_html(reasoning)}\n\n"
        f"{receipt_block}"
    )
    plain = (
        f"📝 New draft\n\n{content}\n\nWhy\n{reasoning}\n\n{receipt_plain_block}"
    )
    return await send_message(
        chat_id=chat_id,
        text=text,
        plain_fallback=plain,
        reply_markup={"inline_keyboard": [[{"text": "𝕏 Post on X", "url": intent_url}]]},
    )


async def send_cycle_briefing(
    *,
    chat_id: int,
    trends: dict,
    x_research: dict,
) -> bool:
    text = format_cycle_briefing_html(trends=trends, x_research=x_research)
    return await send_message(chat_id=chat_id, text=text, plain_fallback=None)


async def send_receipt_only(
    *,
    chat_id: int,
    provider_outputs: dict[str, Any] | None,
    payment_txs: list[str],
    draft_id: str | None = None,
) -> bool:
    """Standalone receipt message (optional follow-up)."""
    html = format_receipt_telegram_html(
        provider_outputs,
        payment_txs,
        draft_id=draft_id,
    )
    plain = format_receipt_telegram_plain(
        provider_outputs,
        payment_txs,
        draft_id=draft_id,
    )
    if not html and not plain:
        return False
    return await send_message(chat_id=chat_id, text=html, plain_fallback=plain)
