from __future__ import annotations

from typing import Any


def stub_provider_response(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Local mock responses matching paid provider shape (no x402)."""
    if path == "/analyze-trends":
        niche = str(payload.get("niche", "AI startups"))
        xr = payload.get("x_research") or {}
        topics = xr.get("trending_topics") or [
            f"{niche} distribution",
            "AI agents replacing SaaS workflows",
        ]
        return {
            "provider": "trend-analyzer",
            "service": "analyze-trends",
            "protocol": "stub",
            "output": {
                "trending_topics": topics,
                "suggested_angles": xr.get("suggested_angles")
                or ["Post outcomes, not feature lists"],
                "engagement_opportunities": ["Reply to high-signal founder threads daily"],
                "grounded_in": "oscorp_stub",
            },
            "_payment_tx": "",
            "_payment": {},
        }

    if path == "/generate-hooks":
        topic = str(payload.get("topic", "AI growth"))
        return {
            "provider": "hook-generator",
            "service": "generate-hooks",
            "protocol": "stub",
            "output": {
                "hooks": [
                    f"Hot take: {topic} is underrated on X right now.",
                    f"3 lessons from shipping in {topic} (thread):",
                    f"Everyone talks about {topic}. Almost nobody shows receipts.",
                ],
            },
            "_payment_tx": "",
            "_payment": {},
        }

    if path == "/generate-thread":
        topic = str(payload.get("topic", "founder distribution"))
        tone = str(payload.get("tone", "technical but casual"))
        return {
            "provider": "thread-generator",
            "service": "generate-thread",
            "protocol": "stub",
            "output": {
                "thread": (
                    f"1/ Why {topic} matters ({tone})\n"
                    f"2/ What most teams get wrong\n"
                    f"3/ What we changed this week\n"
                    f"4/ Results + next experiment"
                ),
            },
            "_payment_tx": "",
            "_payment": {},
        }

    raise ValueError(f"No stub for provider path: {path}")
