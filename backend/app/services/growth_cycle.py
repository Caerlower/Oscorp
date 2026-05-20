from __future__ import annotations

from typing import Any

from app.agent.orchestrator import GrowthContext, GrowthOrchestrator
from app.services.algorand import (
    MIN_CYCLE_USDC_MICRO,
    can_run_growth_cycle,
    get_agent_balances,
)
from app.services.payment_receipt import _payment_tx_from_output
from app.store.memory import UserRecord, store

orchestrator = GrowthOrchestrator()


def build_growth_context(user: UserRecord) -> GrowthContext:
    policy = user.policy or {}
    mem = user.telegram_memory
    niche = mem.preferences.get("niche") or policy.get("niche", "AI startups")
    growth_goal = mem.preferences.get("growth_goal") or policy.get(
        "growth_goal", "Grow audience on X"
    )
    tone = mem.preferences.get("tone") or policy.get("tone", "technical but casual")
    x_handle = mem.preferences.get("x_handle") or policy.get("x_handle", "@founder")
    recent_posts = mem.preferences.get("recent_posts") or policy.get("recent_posts", [])
    prior_drafts = [d.content for d in store.list_drafts(user.id)[:8]]
    merged_posts = list(recent_posts) if isinstance(recent_posts, list) else []
    for content in prior_drafts:
        if content and content not in merged_posts:
            merged_posts.append(content)
    return GrowthContext(
        user_id=user.id,
        niche=str(niche),
        growth_goal=str(growth_goal),
        tone=str(tone),
        x_handle=str(x_handle),
        recent_posts=merged_posts,
        agent_mnemonic=user.agent_mnemonic,
        telegram_summary=mem.summary,
        telegram_feedback=mem.feedback_notes[-8:],
        previous_drafts=prior_drafts,
    )


async def run_growth_cycle_for_user(user: UserRecord) -> dict[str, Any]:
    if not user.policy:
        raise ValueError("Sign your growth policy first")
    balances = get_agent_balances(user.agent_address)
    if not can_run_growth_cycle(balances):
        usdc = int(balances.get("usdc_micro", 0))
        raise ValueError(
            f"Agent wallet needs at least ${MIN_CYCLE_USDC_MICRO / 1_000_000:.2f} USDC "
            f"for provider payments (current: ${usdc / 1_000_000:.2f}). "
            "Use Fund agent to top up."
        )

    ctx = build_growth_context(user)
    result = await orchestrator.run_cycle(ctx)

    payment_txs: list[str] = []
    for out in result.get("provider_outputs", {}).values():
        tx = _payment_tx_from_output(out)
        if tx:
            payment_txs.append(tx)

    draft = result["draft"]
    record = store.add_draft(
        user_id=user.id,
        content=draft["content"],
        reasoning=draft["reasoning"],
        intent_url=draft["intent_url"],
        category=draft["category"],
        provider_outputs=result.get("provider_outputs", {}),
        payment_txs=payment_txs,
    )
    return {
        "result": result,
        "record": record,
        "payment_txs": payment_txs,
    }
