from __future__ import annotations

import html
from typing import Any

from app.services.payment_receipt import LORA_TESTNET_BASE, payment_breakdown

MAX_MESSAGE_LEN = 3900


def escape_html(text: str) -> str:
    return html.escape(text, quote=False)


def _short_tx(txid: str) -> str:
    if len(txid) <= 18:
        return txid
    return f"{txid[:8]}…{txid[-6:]}"


def format_receipt_telegram_html(
    provider_outputs: dict[str, Any] | None,
    payment_txs: list[str] | None,
    *,
    draft_id: str | None = None,
) -> str:
    """Itemized x402 receipt with clickable Lora links (Telegram HTML)."""
    lines = payment_breakdown(provider_outputs, payment_txs)
    if not lines:
        return ""

    header = "<b>💳 Agent spend</b> · x402 · Algorand TestNet"
    if draft_id:
        header += f"\n<i>Receipt #{escape_html(draft_id[:8].upper())}</i>"

    parts = [header]
    for row in lines:
        service = escape_html(str(row["service"]))
        price = escape_html(str(row["price"]))
        tx = row.get("tx")
        url = row.get("explorer_url")
        parts.append(f"\n\n• <b>{service}</b> — {price}")
        if tx and url:
            short = escape_html(_short_tx(str(tx)))
            parts.append(f'\n   ↗ <a href="{url}">View on Lora</a>')
            parts.append(f"\n   <code>{short}</code>")
        elif tx:
            parts.append(f"\n   <code>{escape_html(_short_tx(str(tx)))}</code>")
        else:
            parts.append("\n   <i>No on-chain tx recorded</i>")

    total = sum(float(row.get("amount_usd") or 0) for row in lines)
    parts.append(f"\n\n<b>Total</b> ≈ ${total:.2f} USDC")
    parts.append(f'\n<a href="{LORA_TESTNET_BASE}">AlgoKit Lora (TestNet)</a>')
    return "".join(parts)


def format_no_charge_html() -> str:
    return "<i>No new x402 charges (regenerated copy only).</i>"


def format_receipt_telegram_plain(
    provider_outputs: dict[str, Any] | None,
    payment_txs: list[str] | None,
    *,
    draft_id: str | None = None,
) -> str:
    """Plain-text receipt — Telegram auto-linkifies bare https URLs."""
    lines = payment_breakdown(provider_outputs, payment_txs)
    if not lines:
        return ""

    header = "💳 Agent spend · x402 · Algorand TestNet"
    if draft_id:
        header += f"\nReceipt #{draft_id[:8].upper()}"

    parts = [header]
    for row in lines:
        parts.append(f"\n\n• {row['service']} — {row['price']}")
        url = row.get("explorer_url")
        tx = row.get("tx")
        if url:
            parts.append(f"\nView on Lora: {url}")
        elif tx:
            parts.append(f"\nTx: {tx}")

    total = sum(float(row.get("amount_usd") or 0) for row in lines)
    parts.append(f"\n\nTotal ≈ ${total:.2f} USDC")
    parts.append(f"\n{LORA_TESTNET_BASE}")
    return "".join(parts)


def format_draft_message_plain(
    *,
    content: str,
    reasoning: str,
    provider_outputs: dict[str, Any] | None,
    payment_txs: list[str] | None,
    draft_id: str,
    category: str | None = None,
) -> str:
    receipt = format_receipt_telegram_plain(
        provider_outputs,
        payment_txs,
        draft_id=draft_id,
    )
    receipt_block = receipt if receipt else "No new x402 charges (regenerated copy only)."
    title = "📝 Draft ready"
    if category:
        title += f" · {category}"
    body = (
        f"{title}\n\n"
        f"{content}\n\n"
        f"Why Oscorp picked this\n"
        f"{reasoning}\n\n"
        f"{receipt_block}"
    )
    return body[:MAX_MESSAGE_LEN]


def format_draft_message_html(
    *,
    content: str,
    reasoning: str,
    provider_outputs: dict[str, Any] | None,
    payment_txs: list[str] | None,
    draft_id: str,
    category: str | None = None,
) -> str:
    receipt = format_receipt_telegram_html(
        provider_outputs,
        payment_txs,
        draft_id=draft_id,
    )
    receipt_block = receipt if receipt else format_no_charge_html()

    title = "<b>📝 Draft ready</b>"
    if category:
        title += f" · <i>{escape_html(category)}</i>"

    body = (
        f"{title}\n\n"
        f"{escape_html(content)}\n\n"
        f"<b>Why Oscorp picked this</b>\n"
        f"{escape_html(reasoning)}\n\n"
        f"{receipt_block}"
    )
    return _truncate_html(body)


def format_cycle_briefing_html(
    *,
    trends: dict[str, Any],
    x_research: dict[str, Any],
) -> str:
    topic = escape_html(str(trends.get("top_topic") or "—"))
    source = escape_html(str(x_research.get("source") or "—"))
    lines = [
        "<b>📈 Cycle briefing</b>",
        "",
        f"<b>Top topic</b>\n{topic}",
        "",
        f"<b>Research</b>\n{source}",
    ]
    signals = (x_research.get("x_signals") or "").strip()
    if signals:
        lines.extend(["", f"<b>Signals</b>\n{escape_html(signals[:500])}"])
    topics = trends.get("trending_topics") or []
    if topics:
        preview = ", ".join(escape_html(str(t)) for t in topics[:4])
        lines.extend(["", f"<b>Trending</b>\n{preview}"])
    return "\n".join(lines)


def format_status_html(
    *,
    policy_signed: bool,
    funded: bool,
    usdc_micro: int,
    draft_count: int,
    message_count: int,
    summary: str,
    agent_address: str | None = None,
) -> str:
    usdc = usdc_micro / 1_000_000
    ready = "✅" if funded else "⚠️"
    policy = "✅ Signed" if policy_signed else "❌ Not signed"
    lines = [
        "<b>⚙️ Oscorp status</b>",
        "",
        f"<b>Policy</b> {policy}",
        f"<b>Agent wallet</b> {ready} ${usdc:.2f} USDC",
        f"<b>Drafts</b> {draft_count}",
        f"<b>Chat memory</b> {message_count} messages",
    ]
    if summary:
        lines.extend(["", f"<b>Summary</b>\n{escape_html(summary[:400])}"])
    else:
        lines.extend(["", "<i>Chat to build memory, or /run for a paid draft.</i>"])
    if agent_address:
        short = _short_tx(agent_address) if len(agent_address) > 14 else agent_address
        account_url = f"{LORA_TESTNET_BASE}/account/{agent_address}"
        lines.extend(
            [
                "",
                f'<b>Agent</b> <code>{escape_html(short)}</code>',
                f'<a href="{account_url}">View on Lora</a>',
            ]
        )
    if not funded:
        lines.extend(["", "<i>Fund the agent on the web app, then /run.</i>"])
    return "\n".join(lines)


def format_start_html() -> str:
    return (
        "<b>👋 Oscorp</b> — X growth copilot\n\n"
        "<b>Setup (once)</b>\n"
        "1. Web → connect wallet → sign policy → fund agent\n"
        "2. Copy <b>User ID</b> from Settings\n"
        "3. <code>/link &lt;user-id&gt;</code>\n\n"
        "<b>Daily</b>\n"
        "• <code>/run</code> — paid draft (x402 + Groq)\n"
        "• Chat — teach niche, tone, goals\n"
        "• Buttons — Post on X · ↗ tx links · New draft · Regenerate\n\n"
        "<b>Commands</b>\n"
        "<code>/run</code> <code>/status</code> <code>/memory</code> <code>/clear</code>"
    )


def format_link_success_html() -> str:
    return (
        "<b>✅ Account linked</b>\n\n"
        "Chat your niche and tone, or <code>/run</code> when the agent is funded.\n"
        "Receipts include <a href=\"https://lora.algokit.io/testnet/\">Lora</a> links for each payment."
    )


def _truncate_html(text: str, limit: int = MAX_MESSAGE_LEN) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 20] + "\n\n<i>…truncated</i>"


def plain_to_telegram_html(text: str) -> str:
    """Escape free-form assistant replies for HTML parse mode."""
    return escape_html(text[:4000])
