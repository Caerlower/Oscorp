from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.x402_middleware import agent_payment_dep

router = APIRouter(prefix="/api/company", tags=["company"])


class CompanyDocRequest(BaseModel):
    url: str = Field(..., min_length=1)
    productInfo: str = Field(default="", description="Company summary for context.")
    brandVoice: str = Field(default="", description="Existing brand voice markdown, if any.")


class CompanyDocResponse(BaseModel):
    content: str


@router.post("/brand-voice", response_model=CompanyDocResponse)
async def brand_voice(
    body: CompanyDocRequest,
    _payment: Annotated[dict, Depends(agent_payment_dep("brand_voice"))],
) -> Any:
    voice = body.brandVoice.strip()
    if not voice:
        voice = (
            f"# Brand voice for {body.url}\n\n"
            "Tone: clear, founder-led, confident without hype.\n"
            "Voice: direct sentences, concrete outcomes, minimal jargon.\n"
            "Avoid: empty superlatives and generic AI marketing clichés.\n"
        )
    return CompanyDocResponse(content=voice)


@router.post("/competitors", response_model=CompanyDocResponse)
async def competitors(
    body: CompanyDocRequest,
    _payment: Annotated[dict, Depends(agent_payment_dep("competitors"))],
) -> Any:
    content = (
        f"# Competitor landscape for {body.url}\n\n"
        "Run full analysis to populate live competitor intelligence. "
        "This paid endpoint unlocks competitor refresh for your workspace.\n"
    )
    if body.productInfo.strip():
        content += f"\n## Context\n\n{body.productInfo.strip()}\n"
    return CompanyDocResponse(content=content)
