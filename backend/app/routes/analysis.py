from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.analytics import CompanyProfileInput, analyze_content, run_full_analysis
from app.analytics.lighthouse import run_lighthouse
from app.analytics.scrape import scrape_website
from app.analytics.utils import normalize_url

router = APIRouter(prefix="/api", tags=["analysis"])


class UrlRequest(BaseModel):
    url: str = Field(..., min_length=3)
    company_profile: CompanyProfileInput | None = None


class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=3)
    scrape: dict = Field(default_factory=dict)


@router.post("/scrape")
async def api_scrape(body: UrlRequest) -> dict:
    try:
        url = normalize_url(body.url)
        return await scrape_website(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Scrape failed: {e}") from e


@router.post("/lighthouse")
async def api_lighthouse(body: UrlRequest) -> dict:
    try:
        url = normalize_url(body.url)
        return await run_lighthouse(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lighthouse failed: {e}") from e


@router.post("/analyze")
async def api_analyze(body: AnalyzeRequest) -> dict:
    try:
        url = normalize_url(body.url)
        scrape = body.scrape
        if not scrape:
            scrape = await scrape_website(url)
        return await analyze_content(url, scrape)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Analysis failed: {e}") from e


@router.post("/full-analysis")
async def api_full_analysis(body: UrlRequest) -> dict:
    try:
        url = normalize_url(body.url)
        profile = body.company_profile.model_dump() if body.company_profile else None
        return await run_full_analysis(url, company_profile=profile)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Full analysis failed: {e}") from e
