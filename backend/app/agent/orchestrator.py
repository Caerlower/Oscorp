from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.providers.client import hook_client, thread_client, trend_client
from app.services.content import generate_post_copy
from app.services.growth_research import research_with_fallback
from app.utils.x_intent import build_x_intent_url


@dataclass
class GrowthContext:
    user_id: str
    niche: str
    growth_goal: str
    tone: str
    x_handle: str
    recent_posts: list[str]
    agent_mnemonic: str = ""
    x_research: dict[str, Any] = field(default_factory=dict)
    telegram_summary: str = ""
    telegram_feedback: list[str] = field(default_factory=list)
    previous_drafts: list[str] = field(default_factory=list)


def _rotate(items: list[str], cycle_index: int, count: int) -> list[str]:
    """Pick `count` items starting at a different offset each cycle."""
    if not items:
        return []
    n = len(items)
    start = (cycle_index * count) % n
    return [items[(start + i) % n] for i in range(min(count, n))]


class GrowthOrchestrator:
    """
    Growth loop:
      1. Groq research — topics/angles from policy + memory
      2. x402 — pay specialist providers (trend / hook / thread)
      3. Groq — final draft grounded in research + provider outputs
    """

    async def run_cycle(self, ctx: GrowthContext) -> dict[str, Any]:
        ctx.x_research = await research_with_fallback(
            session_user=ctx.user_id,
            niche=ctx.niche,
            x_handle=ctx.x_handle,
            growth_goal=ctx.growth_goal,
            tone=ctx.tone,
            recent_posts=ctx.recent_posts,
            telegram_summary=ctx.telegram_summary,
            telegram_feedback=ctx.telegram_feedback,
            previous_drafts=ctx.previous_drafts,
        )

        cycle_index = len(ctx.previous_drafts)
        account = self._analyze_account(ctx)
        trends = self._detect_trends(ctx)
        all_topics = trends.get("trending_topics") or []
        if all_topics:
            trends["top_topic"] = all_topics[cycle_index % len(all_topics)]
        strategy = self._decide_strategy(ctx)
        provider_outputs: dict[str, Any] = {}

        x_payload = {
            "niche": ctx.niche,
            "x_handle": ctx.x_handle,
            "x_research": ctx.x_research,
        }

        if strategy["use_trend_provider"]:
            trend_out = await trend_client().call(
                path="/analyze-trends",
                payload={
                    "niche": ctx.niche,
                    "recent_posts": ctx.recent_posts,
                    **x_payload,
                },
                agent_mnemonic=ctx.agent_mnemonic,
            )
            provider_outputs["trends"] = trend_out
            topics = trend_out.get("output", {}).get("trending_topics", [])
            if not topics:
                topics = ctx.x_research.get("trending_topics") or []
            if topics:
                trends["top_topic"] = topics[cycle_index % len(topics)]

        hooks: list[str] = []
        if strategy["use_hook_provider"]:
            topic = trends.get("top_topic", "AI growth")
            hook_out = await hook_client().call(
                path="/generate-hooks",
                payload={
                    "topic": topic,
                    "audience": ctx.niche,
                    "x_research": ctx.x_research,
                },
                agent_mnemonic=ctx.agent_mnemonic,
            )
            provider_outputs["hooks"] = hook_out
            hooks = _rotate(hook_out.get("output", {}).get("hooks", []), cycle_index, 3)

        thread_outline = None
        if strategy["use_thread_provider"]:
            topic = trends.get("top_topic", "founder distribution")
            thread_out = await thread_client().call(
                path="/generate-thread",
                payload={
                    "topic": topic,
                    "tone": ctx.tone,
                    "x_research": ctx.x_research,
                },
                agent_mnemonic=ctx.agent_mnemonic,
            )
            provider_outputs["thread"] = thread_out
            thread_outline = thread_out.get("output", {}).get("thread", "")

        topic = trends.get("top_topic", "building in public")
        content, reasoning = await generate_post_copy(
            niche=ctx.niche,
            goal=ctx.growth_goal,
            tone=ctx.tone,
            topic=topic,
            hooks=hooks if hooks else None,
            thread_outline=thread_outline,
            x_research=ctx.x_research,
            telegram_summary=ctx.telegram_summary,
            telegram_feedback=ctx.telegram_feedback,
            previous_drafts=ctx.previous_drafts,
            cycle_index=cycle_index,
        )

        return {
            "account": account,
            "trends": trends,
            "x_research": ctx.x_research,
            "strategy": strategy,
            "provider_outputs": provider_outputs,
            "draft": {
                "content": content,
                "reasoning": reasoning,
                "intent_url": build_x_intent_url(content),
                "category": strategy["category"],
            },
        }

    def _analyze_account(self, ctx: GrowthContext) -> dict[str, Any]:
        r = ctx.x_research
        return {
            "handle": ctx.x_handle,
            "engagement_delta_pct": r.get("engagement_delta_pct") or 18.0,
            "best_window": r.get("best_posting_window") or "2 PM IST",
            "note": r.get("account_note", ""),
            "source": r.get("source", "unknown"),
        }

    def _detect_trends(self, ctx: GrowthContext) -> dict[str, Any]:
        r = ctx.x_research
        return {
            "top_topic": r.get("top_topic", f"{ctx.niche} distribution"),
            "angle": r.get("angle", ""),
            "engagement_opportunity": r.get("engagement_opportunity", ""),
            "trending_topics": r.get("trending_topics", []),
            "x_signals": r.get("x_signals", ""),
            "source": r.get("source", "unknown"),
        }

    def _decide_strategy(self, ctx: GrowthContext) -> dict[str, Any]:
        plan = ctx.x_research.get("provider_plan") or {}
        return {
            "category": "founder_thoughts",
            "use_trend_provider": plan.get("use_trend_provider", True),
            "use_hook_provider": plan.get("use_hook_provider", True),
            "use_thread_provider": plan.get("use_thread_provider", False),
            "why": plan.get("why", ctx.x_research.get("angle", "")),
            "research_source": ctx.x_research.get("source"),
        }
