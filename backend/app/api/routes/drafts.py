from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.draft_payload import draft_to_api
from app.store.memory import store

router = APIRouter(prefix="/api/drafts", tags=["drafts"])


@router.get("/{user_id}")
async def list_drafts(user_id: str) -> dict:
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    drafts = store.list_drafts(user_id)
    return {
        "drafts": [
            draft_to_api(d, agent_address=user.agent_address) for d in drafts
        ]
    }
