from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.agents.articles import ArticlesRequest, ArticlesResponse, run_articles_agent
from app.core.x402_middleware import agent_payment_dep
from app.agents.hackernews import HackerNewsRequest, HackerNewsResponse, run_hackernews_agent
from app.agents.linkedin import LinkedInRequest, LinkedInResponse, run_linkedin_agent
from app.agents.reddit import RedditRequest, RedditResponse
from app.agents.twitter import TwitterRequest, TwitterResponse, run_twitter_agent
from app.payments.agent_deliverables import persist_paid_agent_result

router = APIRouter(prefix="/api/agents", tags=["agents"])

PAID_AGENTS = frozenset({"linkedin", "articles", "hackernews"})


def _agent_response(result: Any, _ok_model: type) -> Any:
    if isinstance(result, dict) and "error" in result:
        return JSONResponse(status_code=502, content=result)
    return result


async def _run_paid_agent(
    agent: str,
    request: Request,
    runner: Any,
    body: Any,
    ok_model: type,
) -> Any:
    result = await runner(body)
    if agent in PAID_AGENTS and not (isinstance(result, dict) and "error" in result):
        user_id = request.headers.get("X-User-Id")
        if user_id:
            await persist_paid_agent_result(user_id, agent, result)
    return _agent_response(result, ok_model)


@router.post("/reddit", response_model=RedditResponse)
async def api_reddit(_body: RedditRequest) -> Any:
    raise HTTPException(
        status_code=503,
        detail="Reddit agent is not available yet. Community scanning will ship in a future release.",
    )


@router.post("/twitter", response_model=TwitterResponse)
async def api_twitter(body: TwitterRequest) -> Any:
    return _agent_response(await run_twitter_agent(body), TwitterResponse)


@router.post("/linkedin", response_model=LinkedInResponse)
async def api_linkedin(
    body: LinkedInRequest,
    request: Request,
    _payment: Annotated[dict, Depends(agent_payment_dep("linkedin"))],
) -> Any:
    return await _run_paid_agent("linkedin", request, run_linkedin_agent, body, LinkedInResponse)


@router.post("/articles", response_model=ArticlesResponse)
async def api_articles(
    body: ArticlesRequest,
    request: Request,
    _payment: Annotated[dict, Depends(agent_payment_dep("articles"))],
) -> Any:
    return await _run_paid_agent("articles", request, run_articles_agent, body, ArticlesResponse)


@router.post("/hackernews", response_model=HackerNewsResponse)
async def api_hackernews(
    body: HackerNewsRequest,
    request: Request,
    _payment: Annotated[dict, Depends(agent_payment_dep("hackernews"))],
) -> Any:
    return await _run_paid_agent("hackernews", request, run_hackernews_agent, body, HackerNewsResponse)
