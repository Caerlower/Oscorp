from __future__ import annotations

from datetime import datetime, timezone


async def create_campaign_brief(
    *,
    objective: str,
    channel: str,
    budget_usdc: int,
    audience: str = "Founders and growth teams",
    cta: str = "Book a demo",
) -> dict:
    return {
        "objective": objective,
        "channel": channel,
        "budget_usdc": budget_usdc,
        "audience": audience,
        "cta": cta,
        "kpi": "qualified_leads",
        "timeline_days": 7,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def draft_social_post(
    *,
    channel: str,
    product_name: str,
    key_benefit: str,
    cta: str,
) -> dict:
    if channel.lower() == "x":
        content = (
            f"{product_name} helps teams {key_benefit}. "
            f"If you're scaling GTM, this is for you. {cta}"
        )
    else:
        content = (
            f"{product_name} now helps teams {key_benefit}. "
            f"Built for practical GTM outcomes. {cta}"
        )
    return {
        "channel": channel,
        "content": content,
        "hashtags": ["#AI", "#GTM", "#Growth"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
