from __future__ import annotations

from app.services.growth_cycle import build_growth_context
from app.services.content import generate_post_copy
from app.store.memory import DraftRecord, UserRecord, store
from app.utils.x_intent import build_x_intent_url


async def regenerate_draft_for_user(
    user: UserRecord,
    draft_id: str,
    *,
    feedback: str = "",
) -> DraftRecord:
    """Groq-only rewrite — no extra x402 spend."""
    draft = store.get_draft(user.id, draft_id)
    if not draft:
        raise ValueError("Draft not found")

    ctx = build_growth_context(user)
    po = draft.provider_outputs or {}
    trend_out = po.get("trends", {})
    hook_out = po.get("hooks", {})
    thread_out = po.get("thread", {})

    topic = trend_out.get("output", {}).get("trending_topics", [None])
    topic_str = topic[0] if isinstance(topic, list) and topic else ctx.niche
    hooks = hook_out.get("output", {}).get("hooks", [])
    thread_outline = thread_out.get("output", {}).get("thread")

    prior = [d.content for d in store.list_drafts(user.id)[:8]]
    notes = list(ctx.telegram_feedback)
    if feedback.strip():
        notes.append(feedback.strip())

    content, reasoning = await generate_post_copy(
        niche=ctx.niche,
        goal=ctx.growth_goal,
        tone=ctx.tone,
        topic=str(topic_str),
        hooks=hooks[:5] if hooks else None,
        thread_outline=thread_outline,
        x_research={},
        telegram_summary=ctx.telegram_summary,
        telegram_feedback=notes,
        previous_drafts=prior,
        cycle_index=len(prior),
    )

    if feedback.strip():
        reasoning = f"{reasoning} (Regenerated with feedback: {feedback.strip()[:120]})"

    return store.add_draft(
        user_id=user.id,
        content=content,
        reasoning=reasoning,
        intent_url=build_x_intent_url(content),
        category=draft.category,
        provider_outputs=po,
        payment_txs=list(draft.payment_txs or []),
    )
