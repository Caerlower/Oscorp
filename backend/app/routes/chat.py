from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.chat.cmo_chat import CmoChatRequest, run_cmo_chat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def cmo_chat(body: CmoChatRequest) -> dict:
    try:
        reply = await run_cmo_chat(body)
        return {"reply": reply}
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("CMO chat failed")
        raise HTTPException(status_code=502, detail=f"Chat failed: {exc}") from exc
