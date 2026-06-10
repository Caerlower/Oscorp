from __future__ import annotations

import logging
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.groq_client import groq_chat_completion, is_groq_rate_limit
from app.chat.chat_context import build_cmo_context_block, build_cmo_system_prompt

logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=8000)


class CmoChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    site: str = ""
    company_name: str = ""
    company_profile: dict[str, Any] | None = None
    analysis: dict[str, Any] | None = None


async def run_cmo_chat(body: CmoChatRequest) -> str:
    context_block = build_cmo_context_block(
        site=body.site.strip(),
        company_name=body.company_name.strip(),
        company_profile=body.company_profile,
        analysis=body.analysis,
    )
    system = build_cmo_system_prompt(context_block)

    messages: list[dict[str, str]] = []
    for item in body.history[-12:]:
        messages.append({"role": item.role, "content": item.content.strip()})
    messages.append({"role": "user", "content": body.message.strip()})

    try:
        return await groq_chat_completion(
            agent_name="cmo_chat",
            system=system,
            messages=messages,
            max_tokens=2048,
            temperature=0.45,
        )
    except Exception as exc:
        if is_groq_rate_limit(exc):
            logger.warning("CMO chat rate limited: %s", exc)
            raise RuntimeError(
                "AI quota is temporarily exhausted. SEO and docs in your dashboard are still available — try again shortly."
            ) from exc
        raise
