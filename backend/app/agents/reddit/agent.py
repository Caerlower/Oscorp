from __future__ import annotations

from app.agents.reddit.schemas import RedditRequest, RedditResponse

AGENT_NAME = "reddit"


async def run_reddit_agent(body: RedditRequest) -> RedditResponse:
    # Temporarily disabled — avoids Groq queue congestion while other agents stabilize.
    return RedditResponse(opportunities=[])
