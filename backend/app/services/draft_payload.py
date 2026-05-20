from __future__ import annotations

from app.services.payment_receipt import payment_breakdown, receipt_summary
from app.store.memory import DraftRecord


def draft_to_api(d: DraftRecord, *, agent_address: str | None = None) -> dict:
    breakdown = payment_breakdown(d.provider_outputs, d.payment_txs)
    return {
        "id": d.id,
        "content": d.content,
        "reasoning": d.reasoning,
        "intent_url": d.intent_url,
        "category": d.category,
        "payment_txs": d.payment_txs,
        "payment_breakdown": breakdown,
        "payment_receipt": receipt_summary(
            draft_id=d.id,
            created_at=d.created_at,
            lines=breakdown,
            agent_address=agent_address,
        ),
        "created_at": d.created_at.isoformat(),
    }
