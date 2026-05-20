from __future__ import annotations

from datetime import datetime
from typing import Any

from app.config.settings import settings

LORA_TESTNET_BASE = "https://lora.algokit.io/testnet"
TESTNET_EXPLORER_TX = f"{LORA_TESTNET_BASE}/transaction/{{txid}}"

PROVIDER_META: dict[str, dict[str, Any]] = {
    "trends": {
        "service": "Trend analyzer",
        "description": "Niche trend scan to choose topical angles for your draft",
        "endpoint": "/analyze-trends",
        "sku": "oscorp.trend-analyzer",
        "amount_usd": 0.01,
        "amount_micro": 10_000,
    },
    "hooks": {
        "service": "Hook generator",
        "description": "High-conversion hook variants aligned to your topic and audience",
        "endpoint": "/generate-hooks",
        "sku": "oscorp.hook-generator",
        "amount_usd": 0.01,
        "amount_micro": 10_000,
    },
    "thread": {
        "service": "Thread generator",
        "description": "Structured thread outline for long-form X posts",
        "endpoint": "/generate-thread",
        "sku": "oscorp.thread-generator",
        "amount_usd": 0.01,
        "amount_micro": 10_000,
    },
}


def _payment_tx_from_output(out: Any) -> str | None:
    """Read settlement tx from provider response (preferred over parallel tx list)."""
    if not isinstance(out, dict):
        return None
    direct = str(out.get("_payment_tx") or "").strip()
    if direct:
        return direct
    payment = out.get("_payment")
    if isinstance(payment, dict):
        nested = str(payment.get("transaction") or payment.get("txId") or "").strip()
        if nested:
            return nested
    return None


def payment_breakdown(
    provider_outputs: dict[str, Any] | None,
    payment_txs: list[str] | None,
) -> list[dict[str, Any]]:
    """Map provider_outputs + tx list to itemized x402 receipt lines."""
    outputs = provider_outputs or {}
    txs = list(payment_txs or [])
    lines: list[dict[str, Any]] = []
    tx_idx = 0
    for key, meta in PROVIDER_META.items():
        if key not in outputs:
            continue
        out = outputs[key]
        tx = _payment_tx_from_output(out)
        if not tx and tx_idx < len(txs):
            tx = str(txs[tx_idx]).strip() or None
        tx_idx += 1
        paid = bool(tx)
        lines.append(
            {
                "provider": key,
                "service": meta["service"],
                "description": meta["description"],
                "endpoint": meta["endpoint"],
                "sku": meta["sku"],
                "price": f"${meta['amount_usd']:.2f}",
                "amount_usd": meta["amount_usd"],
                "amount_micro": meta["amount_micro"],
                "quantity": 1,
                "tx": tx,
                "status": "Paid" if paid else "Pending",
                "method": "x402",
                "explorer_url": TESTNET_EXPLORER_TX.format(txid=tx) if tx else None,
            }
        )
    return lines


def receipt_summary(
    *,
    draft_id: str,
    created_at: datetime,
    lines: list[dict[str, Any]],
    agent_address: str | None = None,
) -> dict[str, Any]:
    """Header + totals for a Web2-style receipt panel."""
    total_usd = sum(float(row.get("amount_usd") or 0) for row in lines)
    total_micro = sum(int(row.get("amount_micro") or 0) for row in lines)
    tx_count = sum(1 for row in lines if row.get("tx"))
    return {
        "receipt_id": draft_id[:8].upper(),
        "draft_id": draft_id,
        "issued_at": created_at.isoformat(),
        "status": (
            "No charge"
            if not lines
            else "Paid"
            if tx_count == len(lines)
            else "Partial"
            if tx_count
            else "Pending"
        ),
        "protocol": "x402",
        "network": "Algorand TestNet",
        "currency": "USDC",
        "asset_id": settings.usdc_asset_id,
        "line_count": len(lines),
        "transaction_count": tx_count,
        "subtotal_usd": round(total_usd, 2),
        "total_usd": round(total_usd, 2),
        "total_micro": total_micro,
        "payer_label": "Oscorp agent wallet",
        "payer_address": agent_address,
    }


def format_receipt_text(
    provider_outputs: dict[str, Any] | None,
    payment_txs: list[str] | None,
) -> str:
    """Plain-text receipt (logs / fallback)."""
    lines = payment_breakdown(provider_outputs, payment_txs)
    if not lines:
        return ""
    parts = []
    for row in lines:
        tx = row.get("tx")
        url = row.get("explorer_url")
        line = f"• {row['service']} {row['price']}"
        if tx and url:
            line += f"\n  {url}"
        parts.append(line)
    total = sum(float(row.get("amount_usd") or 0) for row in lines)
    return (
        "x402 (Algorand TestNet):\n"
        + "\n".join(parts)
        + f"\nTotal ≈ ${total:.2f} USDC\n"
        + f"{LORA_TESTNET_BASE}"
    )
