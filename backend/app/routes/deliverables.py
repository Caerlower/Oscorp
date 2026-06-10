from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.agents.twitter.schemas import TwitterRequest
from app.payments.agent_deliverables import (
    PAID_AGENT_DAILY_LIMIT,
    mark_deliverable_posted,
    resolve_paid_agent_access,
    restore_paid_agent_deliverable,
    sync_twitter_deliverables,
)
from app.db.supabase_client import SupabaseError, supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/deliverables", tags=["deliverables"])


class TwitterSyncResponse(BaseModel):
    tweets: list[dict[str, Any]]
    allPostedToday: bool = False


@router.post("/users/{user_id}/twitter/sync", response_model=TwitterSyncResponse)
async def sync_twitter_feed(user_id: str, body: TwitterRequest) -> Any:
    if not supabase.enabled:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        tweets = await sync_twitter_deliverables(user_id, body)
        return {"tweets": tweets, "allPostedToday": len(tweets) == 0}
    except SupabaseError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.warning("Twitter sync failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/users/{user_id}/agents/{agent}")
async def get_paid_agent_deliverable(user_id: str, agent: str) -> Any:
    if agent not in PAID_AGENT_DAILY_LIMIT:
        raise HTTPException(status_code=404, detail="Unknown agent")
    if not supabase.enabled:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        access = await resolve_paid_agent_access(user_id, agent)
        status = access["status"]
        data = access.get("data")
        return {
            "agent": agent,
            "status": status,
            "unlocked": status == "unlocked",
            "data": data,
        }
    except SupabaseError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/users/{user_id}/agents/{agent}/restore")
async def restore_paid_agent(user_id: str, agent: str, body: dict[str, Any]) -> Any:
    if agent not in PAID_AGENT_DAILY_LIMIT:
        raise HTTPException(status_code=404, detail="Unknown agent")
    if not supabase.enabled:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        data = await restore_paid_agent_deliverable(user_id, agent, body)
        return {"agent": agent, "unlocked": True, "data": data}
    except SupabaseError as exc:
        msg = str(exc)
        if "No confirmed payment" in msg:
            raise HTTPException(status_code=402, detail={"error": msg}) from exc
        raise HTTPException(status_code=502, detail=msg) from exc
    except RuntimeError as exc:
        logger.warning("Restore failed for %s/%s: %s", user_id, agent, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.patch("/{deliverable_id}/posted")
async def mark_deliverable_complete(deliverable_id: str, request: Request) -> Any:
    x_user_id = request.headers.get("X-User-Id")
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    if not supabase.enabled:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        return await mark_deliverable_posted(x_user_id, deliverable_id)
    except SupabaseError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
