from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from app.analytics.company import format_company_context_block, parse_company_profile
from app.analytics.competitors import build_competitor_analysis_markdown, ensure_market_competitors
from app.analytics.documents import generate_company_documents, normalize_document_markdown
from app.analytics.seo import (
    build_seo_issues,
    compute_content_relevance,
    estimated_page_size_label,
)
from app.analytics.lighthouse import run_lighthouse
from app.analytics.scrape import scrape_website
from app.core.groq_client import is_groq_rate_limit
from app.analytics.utils import domain_from_url, favicon_url, normalize_url


def _readability(word_count: int) -> str:
    if word_count < 250:
        return "Difficult"
    if word_count < 600:
        return "Moderate"
    return "Easy"


def _health_from_scrape(metadata: dict[str, Any], mobile_friendly: bool) -> dict[str, Any]:
    meta_desc = metadata.get("metaDescription") or ""
    word_count = metadata.get("wordCount") or 0
    return {
        "metaDescription": {
            "present": bool(meta_desc),
            "value": meta_desc,
            "length": len(meta_desc),
        },
        "canonicalUrl": {
            "present": bool(metadata.get("canonicalUrl")),
            "value": metadata.get("canonicalUrl") or "",
        },
        "language": {
            "present": bool(metadata.get("language")),
            "value": metadata.get("language") or "",
        },
        "mobileFriendly": mobile_friendly,
        "wordCount": word_count,
        "readability": _readability(word_count),
    }


def _social_tags(metadata: dict[str, Any]) -> dict[str, str]:
    return {
        "ogTitle": metadata.get("ogTitle") or "",
        "ogDescription": metadata.get("ogDescription") or "",
        "ogImage": metadata.get("ogImage") or "",
        "ogType": metadata.get("ogType") or "",
        "twitterCard": metadata.get("twitterCard") or "",
        "twitterTitle": metadata.get("twitterTitle") or "",
        "twitterSite": metadata.get("twitterSite") or "",
        "twitterImage": metadata.get("twitterImage") or "",
    }


def _keyword_tags(metadata: dict[str, Any]) -> list[str]:
    raw = str(metadata.get("keywords") or "").strip()
    if not raw:
        return []
    parts = [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]
    seen: set[str] = set()
    tags: list[str] = []
    for part in parts[:8]:
        key = part.lower()
        if key in seen:
            continue
        seen.add(key)
        tags.append(part)
    return tags


def _fallback_analysis(scrape: dict[str, Any], domain: str) -> dict[str, Any]:
    """Placeholder company/docs when Groq rate limit blocks the AI step only."""
    meta = scrape.get("metadata") or {}
    name = (meta.get("title") or domain).split(" - ")[0].split(" | ")[0].strip()
    category = str(meta.get("ogType") or "").strip().title() or "Technology"
    return {
        "company": {
            "name": name or domain,
            "description": meta.get("metaDescription") or meta.get("ogDescription") or "",
            "category": category,
            "tags": _keyword_tags(meta),
        },
        "documents": {},
        "competitors": [],
    }


async def run_full_analysis(url: str, company_profile: dict | None = None) -> dict[str, Any]:
    normalized = normalize_url(url)

    scrape_result, lighthouse_result = await asyncio.gather(
        scrape_website(normalized),
        run_lighthouse(normalized),
    )

    analyzed_url = (
        lighthouse_result.get("analyzedUrl")
        or scrape_result.get("analyzedUrl")
        or normalized
    )
    domain = domain_from_url(analyzed_url)

    groq_status = "complete"
    groq_message: str | None = None
    profile = parse_company_profile(company_profile)
    company_block = format_company_context_block(profile)
    try:
        analysis = await generate_company_documents(
            analyzed_url, scrape_result, company_context=company_block
        )
    except Exception as exc:
        if is_groq_rate_limit(exc):
            groq_status = "rate_limited"
            groq_message = "Groq rate limit reached. SEO and technical metrics are live; AI company insights will refresh when quota resets."
            analysis = _fallback_analysis(scrape_result, domain)
        else:
            raise
    metadata = scrape_result.get("metadata") or {}
    response = scrape_result.get("response") or {}
    headings = scrape_result.get("headings") or {}

    competitors, competitors_status = await ensure_market_competitors(
        analyzed_url, scrape_result, analysis
    )
    analysis["competitors"] = competitors
    if competitors:
        company = analysis.get("company") or {}
        company_name = company.get("name") or domain.split(".")[0].title()
        docs = analysis.get("documents") or {}
        docs["competitorAnalysis"] = normalize_document_markdown(
            build_competitor_analysis_markdown(
                competitors,
                company_name=str(company_name),
                url=analyzed_url,
                generated_at=datetime.now(UTC).isoformat(),
            )
        )
        analysis["documents"] = docs

    for c in competitors:
        if isinstance(c, dict) and c.get("domain"):
            c["faviconUrl"] = favicon_url(str(c["domain"]))

    word_count = metadata.get("wordCount") or 0
    mobile_friendly = lighthouse_result.get("mobileFriendly", True)
    dom_elements = int(lighthouse_result.get("domElements") or 0)
    dom_label = lighthouse_result.get("domSizeLabel") or "—"

    estimated_page = estimated_page_size_label(dom_elements)
    page_size_label = estimated_page or lighthouse_result.get("pageSizeLabel") or response.get("pageSizeLabel") or "—"

    relevance = compute_content_relevance(scrape_result, lighthouse_result)
    health = _health_from_scrape(metadata, mobile_friendly)
    seo_issues = build_seo_issues(
        lighthouse=lighthouse_result,
        word_count=word_count,
        content_rate=relevance.get("contentRate") or 0,
        health=health,
    )

    return {
        "domain": domain,
        "requestedUrl": normalized,
        "analyzedUrl": analyzed_url,
        "analyzedAt": datetime.now(UTC).isoformat(),
        "company": analysis.get("company") or {},
        "documents": analysis.get("documents") or {},
        "competitors": competitors,
        "competitorsSource": "market_research" if competitors else competitors_status,
        "competitorsStatus": competitors_status,
        "seo": {
            "pagespeed": {
                "mobile": lighthouse_result.get("mobile") or {},
                "desktop": lighthouse_result.get("desktop") or {},
            },
            "coreWebVitals": lighthouse_result.get("coreWebVitals") or {},
            "health": health,
            "issues": seo_issues,
            "lighthouseVersion": lighthouse_result.get("lighthouseVersion") or "",
        },
        "technical": {
            "onPageScore": lighthouse_result.get("onPageScore") or 0,
            "server": {
                "name": response.get("server") or "Unknown",
                "status": response.get("status") or 0,
                "encoding": response.get("encoding") or "—",
                "pageSize": page_size_label,
                "domSize": dom_label,
                "cacheable": lighthouse_result.get("cacheable", response.get("cacheable", True)),
            },
            "serverTiming": lighthouse_result.get("serverTiming") or {},
            "renderBlocking": lighthouse_result.get("renderBlocking") or {},
            "ttfb": lighthouse_result.get("ttfb") or 0,
            "domSize": lighthouse_result.get("domSize") or dom_elements,
        },
        "contentRelevance": relevance,
        "headings": {
            "h1": headings.get("h1") or [],
            "h2": headings.get("h2") or [],
            "h3": headings.get("h3") or [],
        },
        "socialTags": _social_tags(metadata),
        "metaKeywords": _keyword_tags(metadata),
        "scrapeSource": scrape_result.get("source"),
        "aiAnalysis": {
            "provider": "groq",
            "status": groq_status,
            "message": groq_message,
        },
    }
