from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from app.db.supabase_client import SupabaseError, supabase


def normalize_workspace_site(url: str) -> str:
    raw = str(url or "").strip().lower()
    if not raw:
        raise ValueError("site_url is required")
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    host = parsed.netloc.replace("www.", "")
    if not host:
        raise ValueError("Invalid site_url")
    return host


def _empty_workspace(user_id: str, site_url: str) -> dict[str, Any]:
    return {
        "user_id": user_id,
        "site_url": site_url,
        "analysis": None,
        "company_profile": {},
        "edited_documents": {},
        "chat_active_messages": [],
        "chat_archived_sessions": [],
        "analysis_updated_at": None,
        "created_at": None,
        "updated_at": None,
    }


async def get_workspace(user_id: str, site_url: str) -> dict[str, Any]:
    if not supabase.enabled:
        raise SupabaseError("Supabase is not configured")
    normalized = normalize_workspace_site(site_url)
    row = await supabase.get_user_workspace(user_id, normalized)
    if not row:
        return _empty_workspace(user_id, normalized)
    return row


async def upsert_workspace(user_id: str, *, site_url: str, patch: dict[str, Any]) -> dict[str, Any]:
    if not supabase.enabled:
        raise SupabaseError("Supabase is not configured")

    normalized = normalize_workspace_site(site_url)
    existing = await supabase.get_user_workspace(user_id, normalized)
    now = datetime.now(UTC).isoformat()

    row: dict[str, Any] = {
        "user_id": user_id,
        "site_url": normalized,
        "updated_at": now,
    }

    if "analysis" in patch:
        analysis = patch.get("analysis")
        row["analysis"] = analysis
        row["analysis_updated_at"] = (
            str(analysis.get("analyzedAt") or now) if isinstance(analysis, dict) else now
        )
    if "company_profile" in patch:
        row["company_profile"] = patch.get("company_profile") or {}
    if "edited_documents" in patch:
        row["edited_documents"] = patch.get("edited_documents") or {}
    if "chat_active_messages" in patch:
        row["chat_active_messages"] = patch.get("chat_active_messages") or []
    if "chat_archived_sessions" in patch:
        row["chat_archived_sessions"] = patch.get("chat_archived_sessions") or []

    if existing:
        return await supabase.update_user_workspace(user_id, normalized, row)

    defaults: dict[str, Any] = {
        "user_id": user_id,
        "site_url": normalized,
        "analysis": patch.get("analysis"),
        "company_profile": patch.get("company_profile") or {},
        "edited_documents": patch.get("edited_documents") or {},
        "chat_active_messages": patch.get("chat_active_messages") or [],
        "chat_archived_sessions": patch.get("chat_archived_sessions") or [],
        "analysis_updated_at": row.get("analysis_updated_at"),
        "created_at": now,
        "updated_at": now,
    }
    return await supabase.insert_user_workspace(defaults)
