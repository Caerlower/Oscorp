"""Pre-cycle growth research via Groq (no live X API — synthesizes from policy + memory)."""

from __future__ import annotations

import json
import re
from typing import Any

from app.config.settings import settings
from app.services.content import _groq_client


class ResearchError(Exception):
    pass


def is_groq_research_available() -> bool:
    return bool(settings.groq_api_key.strip()) and settings.groq_research_enabled


def research_health() -> dict[str, Any]:
    return {
        "mode": "groq" if is_groq_research_available() else "stub",
        "groq_configured": bool(settings.groq_api_key.strip()),
        "research_enabled": settings.groq_research_enabled,
        "model": settings.groq_model,
        "note": (
            "Groq synthesizes topics/angles from your niche, posts, and Telegram memory. "
            "Not live X API data."
            if is_groq_research_available()
            else "Set GROQ_API_KEY for AI research; otherwise stub topics are used."
        ),
    }


def _parse_json_blob(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {"raw_summary": text}


def _normalize_research(parsed: dict[str, Any], niche: str) -> dict[str, Any]:
    """Ensure required fields exist for orchestrator + providers."""
    topics = parsed.get("trending_topics")
    if not isinstance(topics, list) or not topics:
        top = parsed.get("top_topic") or f"{niche} distribution"
        topics = [str(top), f"{niche} on X", "founder-led growth"]
    else:
        topics = [str(t) for t in topics[:6]]

    angles = parsed.get("suggested_angles")
    if not isinstance(angles, list) or not angles:
        angles = ["Post outcomes, not feature lists", "Contrarian founder take"]

    plan = parsed.get("provider_plan")
    if not isinstance(plan, dict):
        plan = {}
    plan.setdefault("use_trend_provider", True)
    plan.setdefault("use_hook_provider", True)
    plan.setdefault("use_thread_provider", False)
    plan.setdefault("why", plan.get("why") or "Trend + hooks before draft")

    return {
        "source": "groq",
        "top_topic": str(parsed.get("top_topic") or topics[0]),
        "angle": str(parsed.get("angle") or ""),
        "engagement_opportunity": str(parsed.get("engagement_opportunity") or ""),
        "trending_topics": topics,
        "suggested_angles": [str(a) for a in angles[:5]],
        "account_note": str(parsed.get("account_note") or ""),
        "best_posting_window": str(parsed.get("best_posting_window") or "2 PM IST"),
        "engagement_delta_pct": parsed.get("engagement_delta_pct"),
        "x_signals": str(parsed.get("x_signals") or parsed.get("raw_summary") or ""),
        "provider_plan": plan,
        "raw_excerpt": str(parsed.get("raw_excerpt", ""))[:2000],
    }


async def groq_research_x_context(
    *,
    session_user: str,
    niche: str,
    x_handle: str,
    growth_goal: str,
    tone: str,
    recent_posts: list[str],
    telegram_summary: str = "",
    telegram_feedback: list[str] | None = None,
    previous_drafts: list[str] | None = None,
) -> dict[str, Any]:
    """
    Groq research pass before x402 provider calls.
    Uses policy + memory — does not call X/Twitter APIs.
    """
    if not settings.groq_api_key:
        raise ResearchError("GROQ_API_KEY is not set")

    posts_block = "\n".join(f"- {p}" for p in recent_posts[:8]) or "- (none)"
    prior_block = "\n".join(f"- {p}" for p in (previous_drafts or [])[:5]) or "- (none)"
    feedback = telegram_feedback or []

    prompt = f"""You are Oscorp's X growth strategist. Plan the next post for this profile.
You do NOT have live X API access — infer likely trends from niche, goals, tone, memory, and recent posts.
Avoid repeating topics/openings from previous drafts.

Profile:
- user_id: {session_user}
- niche: {niche}
- x_handle: {x_handle}
- growth_goal: {growth_goal}
- tone: {tone}

Recent posts / drafts:
{posts_block}

Previous draft lines to avoid repeating:
{prior_block}

Telegram memory: {telegram_summary or "(none)"}
User feedback: {feedback}

Return ONLY valid JSON (no markdown fences):
{{
  "top_topic": "string — single best topic for next post",
  "angle": "string — contrarian or specific angle",
  "engagement_opportunity": "string — e.g. reply threads, quote posts",
  "trending_topics": ["3-5 distinct topic strings, rotate away from prior drafts"],
  "suggested_angles": ["2-4 post angles"],
  "account_note": "string — brief note for the founder",
  "best_posting_window": "string",
  "engagement_delta_pct": null,
  "x_signals": "one paragraph: what to emphasize this cycle",
  "provider_plan": {{
    "use_trend_provider": true,
    "use_hook_provider": true,
    "use_thread_provider": false,
    "why": "one sentence why trend+hook providers help"
  }}
}}"""

    client = _groq_client()
    response = await client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You output valid JSON only. Be specific to the niche; vary topics each cycle."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.85,
        max_tokens=800,
    )
    raw = response.choices[0].message.content or "{}"
    parsed = _parse_json_blob(raw)
    parsed["raw_excerpt"] = raw[:2000]
    return _normalize_research(parsed, niche)


def stub_research(niche: str, *, note: str = "") -> dict[str, Any]:
    out = _normalize_research(
        {
            "top_topic": f"{niche} distribution",
            "angle": "Most teams post features, not outcomes.",
            "engagement_opportunity": "Reply to founder threads with contrarian insights.",
            "trending_topics": [f"{niche} distribution", "AI agents on X", "building in public"],
            "suggested_angles": ["Post outcomes, not feature lists"],
            "account_note": note or "Groq research off — using placeholder topics.",
            "x_signals": "",
            "provider_plan": {
                "use_trend_provider": True,
                "use_hook_provider": True,
                "use_thread_provider": False,
                "why": "Default strategy",
            },
        },
        niche,
    )
    out["source"] = "stub"
    return out


async def research_with_fallback(
    *,
    session_user: str,
    niche: str,
    x_handle: str,
    growth_goal: str,
    tone: str,
    recent_posts: list[str],
    telegram_summary: str = "",
    telegram_feedback: list[str] | None = None,
    previous_drafts: list[str] | None = None,
) -> dict[str, Any]:
    if is_groq_research_available():
        try:
            return await groq_research_x_context(
                session_user=session_user,
                niche=niche,
                x_handle=x_handle,
                growth_goal=growth_goal,
                tone=tone,
                recent_posts=recent_posts,
                telegram_summary=telegram_summary,
                telegram_feedback=telegram_feedback,
                previous_drafts=previous_drafts,
            )
        except Exception as exc:
            return stub_research(niche, note=f"Groq research failed: {exc}")
    if settings.groq_api_key and not settings.groq_research_enabled:
        return stub_research(niche, note="OSCORP_GROQ_RESEARCH_ENABLED=false")
    return stub_research(niche, note="Set GROQ_API_KEY for AI research.")
