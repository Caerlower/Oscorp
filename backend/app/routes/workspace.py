from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.db.supabase_client import SupabaseError, supabase
from app.workspace.service import get_workspace, normalize_workspace_site, upsert_workspace

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


class WorkspaceUpsertRequest(BaseModel):
    site_url: str = Field(..., min_length=1)
    analysis: dict[str, Any] | None = None
    company_profile: dict[str, Any] | None = None
    edited_documents: dict[str, Any] | None = None
    chat_active_messages: list[dict[str, Any]] | None = None
    chat_archived_sessions: list[dict[str, Any]] | None = None


@router.get("/users/{user_id}")
async def read_workspace(
    user_id: str,
    site_url: str = Query(..., min_length=1),
) -> dict[str, Any]:
    if not supabase.enabled:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        normalize_workspace_site(site_url)
        return await get_workspace(user_id, site_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SupabaseError as exc:
        logger.warning("Workspace read failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.put("/users/{user_id}")
async def write_workspace(user_id: str, body: WorkspaceUpsertRequest) -> dict[str, Any]:
    if not supabase.enabled:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    patch = body.model_dump(exclude_none=True)
    if len(patch) <= 1:
        raise HTTPException(status_code=400, detail="No workspace fields to update")
    try:
        return await upsert_workspace(user_id, site_url=body.site_url, patch=patch)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SupabaseError as exc:
        logger.warning("Workspace write failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
