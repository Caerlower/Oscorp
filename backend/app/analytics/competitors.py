"""Market competitor identification via Groq — direct competitors only."""

from __future__ import annotations

import logging
import re
from typing import Any

from app.analytics.utils import domain_from_url, normalize_url

logger = logging.getLogger(__name__)

COMPETITOR_SYSTEM = """You are a market research analyst specializing in competitive intelligence.
Your job is to identify the DIRECT market competitors of a product — companies that a customer would evaluate INSTEAD OF this product when making a purchase decision.

Rules:
- Only include companies that solve the SAME problem for the SAME customer
- A competitor must be something a customer would choose INSTEAD OF this product
- Do NOT include: partners, integrations, infrastructure providers, tangentially related tools, or companies in adjacent but different markets
- Include both well-known competitors AND emerging/niche ones
- If the product is a niche tool, include the broader category leaders too
- Prioritize companies by how directly they compete, not by brand recognition
- Use your knowledge of established software markets and "alternatives to X" buyer searches — NOT brands merely mentioned on the company's website
- Example: for payment processing, competitors are Adyen, PayPal, Square, Checkout.com — NOT wallet apps or blockchains listed as integrations"""

USER_PROMPT = """Analyze this product and identify its true market competitors.

Product URL: {url}
Product category: {company_category}
Company: {company_name}

Product info (primary signal — use this to determine market positioning):
{product_info}

Website content (secondary — for context only):
{scraped_content}

CRITICAL: Ignore brands mentioned in website content as integrations, wallets, partners, infrastructure, or tech stack. Those are NOT competitors. Identify companies a buyer would evaluate instead of this product in the same software category.

Think step by step:
1. What is the core problem this product solves?
2. Who is the target customer?
3. What would that customer use if this product didn't exist?
4. Which companies are fighting for the same customer and same budget?

Return JSON only matching this exact schema:
{{
  "competitors": [
    {{
      "domain": "stripe.com",
      "name": "Stripe",
      "reason": "one sentence why they are a direct competitor",
      "similarityScore": 9,
      "competitorType": "direct"
    }}
  ]
}}

Return 5-8 competitors maximum, sorted by similarityScore descending.
Only include competitors with similarityScore >= 6."""

STRICT_RETRY_SUFFIX = """

Focus only on companies the user would Google when searching for alternatives to this product."""

VALID_COMPETITOR_TYPES = frozenset({"direct", "indirect", "emerging"})


def _normalize_domain(value: str) -> str:
    raw = str(value or "").strip().lower()
    raw = re.sub(r"^https?://", "", raw)
    raw = raw.split("/")[0].replace("www.", "")
    return raw


def _coerce_score(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        score = int(float(value))
    except (TypeError, ValueError):
        return None
    return score


def _normalize_competitor_type(value: Any) -> str:
    raw = str(value or "direct").strip().lower()
    if raw in VALID_COMPETITOR_TYPES:
        return raw
    if "direct" in raw:
        return "direct"
    if "indirect" in raw:
        return "indirect"
    if "emerg" in raw:
        return "emerging"
    return "direct"


def _validate_competitors(
    raw: list[Any],
    *,
    product_domain: str,
) -> list[dict[str, Any]]:
    product_host = _normalize_domain(product_domain)
    validated: list[dict[str, Any]] = []

    for row in raw:
        if not isinstance(row, dict):
            continue

        domain = _normalize_domain(str(row.get("domain") or ""))
        name = str(row.get("name") or "").strip()
        reason = str(row.get("reason") or row.get("description") or "").strip()
        score = _coerce_score(row.get("similarityScore"))
        competitor_type = _normalize_competitor_type(row.get("competitorType"))

        if not domain or not name or not reason:
            logger.debug("Dropped competitor row (missing fields): %s", row)
            continue
        if domain == product_host or domain.endswith(f".{product_host}") or product_host.endswith(f".{domain}"):
            logger.debug("Dropped competitor row (product domain): %s", domain)
            continue
        if score is None:
            score = 7
        if score < 6:
            logger.debug("Dropped competitor row (low score %s): %s", score, domain)
            continue

        validated.append(
            {
                "domain": domain,
                "name": name,
                "reason": reason,
                "similarityScore": score,
                "competitorType": competitor_type,
            }
        )

    validated.sort(key=lambda c: c["similarityScore"], reverse=True)
    return validated[:8]


def _to_pipeline_competitors(validated: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map to the shape consumed by run_full_analysis and the frontend."""
    return [
        {
            "name": c["name"],
            "domain": c["domain"],
            "description": c["reason"],
            "strengths": [],
            "similarityScore": c["similarityScore"],
            "competitorType": c["competitorType"],
        }
        for c in validated
    ]


def build_competitor_analysis_markdown(
    competitors: list[dict[str, Any]],
    *,
    company_name: str,
    url: str,
    generated_at: str,
) -> str:
    lines = [
        "# Competitor Analysis",
        "",
        "## Overview",
        (
            f"Market scan for **{company_name}** ({url}): "
            f"{len(competitors)} direct alternatives a buyer would evaluate instead of this product."
        ),
        "",
        "## Market Positioning",
        "Competitors below are ranked by how directly they compete for the same customer and budget — not by topical similarity or ecosystem mentions.",
        "",
        "## Direct Competitors",
    ]

    for c in competitors:
        ctype = c.get("competitorType", "direct")
        score = c.get("similarityScore", "—")
        desc = c.get("description") or c.get("reason", "")
        lines.extend(
            [
                f"### {c['name']} ({c['domain']})",
                f"- **Competition score:** {score}/10 ({ctype})",
                f"- **Why they compete:** {desc}",
                "",
            ]
        )

    lines.extend(
        [
            "## Differentiation Opportunities",
            "- Emphasize capabilities competitors lack in positioning and comparison pages.",
            "- Target keywords where rivals are weak in SEO and paid search.",
            "",
            "## Content & SEO Angles",
            "- Publish alternative and versus pages for each direct competitor above.",
            "- Use comparison keywords: best [category], [competitor] alternative, [product] vs [competitor].",
            "",
            "## Strategic Recommendations",
            "1. Lead with the core problem you solve better than category leaders.",
            "2. Win evaluation-stage searches with honest comparison content.",
            "3. Monitor emerging entrants with high similarity scores quarterly.",
            "",
            f"Generated on {generated_at}",
        ]
    )
    return "\n".join(lines)


async def _request_competitors(
    *,
    url: str,
    scraped_content: str,
    product_info: str,
    company_category: str,
    company_name: str,
    strict: bool = False,
) -> list[dict[str, Any]]:
    user = USER_PROMPT.format(
        url=url,
        company_category=company_category or "Unknown",
        company_name=company_name or "Unknown",
        scraped_content=scraped_content[:2500],
        product_info=product_info[:4000] or "Not available — infer market category from URL and category only.",
    )
    if strict:
        user += STRICT_RETRY_SUFFIX

    from app.core.groq_client import groq_json_completion

    payload = await groq_json_completion(
        agent_name="competitor_analysis",
        system=COMPETITOR_SYSTEM,
        user=user,
        max_tokens=2048,
        temperature=0.25,
        strict=True,
    )
    raw = payload.get("competitors")
    if not isinstance(raw, list):
        return []
    return raw


async def identify_market_competitors(
    url: str,
    scrape: dict[str, Any],
    *,
    product_info: str = "",
    company_category: str = "",
    company_name: str = "",
) -> list[dict[str, Any]]:
    """
    Identify validated direct market competitors for a product.
    Retries once with a stricter prompt if fewer than 3 pass validation.
    """
    normalized = normalize_url(url)
    product_domain = domain_from_url(normalized)
    scraped_content = (scrape.get("markdown") or scrape.get("bodyText") or "").strip()
    if not scraped_content:
        metadata = scrape.get("metadata") or {}
        scraped_content = "\n".join(
            filter(
                None,
                [
                    str(metadata.get("title") or ""),
                    str(metadata.get("metaDescription") or ""),
                    str(metadata.get("ogDescription") or ""),
                ],
            )
        )

    raw = await _request_competitors(
        url=normalized,
        scraped_content=scraped_content,
        product_info=product_info,
        company_category=company_category,
        company_name=company_name,
        strict=False,
    )
    validated = _validate_competitors(raw, product_domain=product_domain)
    logger.info(
        "Competitor analysis for %s: %s raw, %s valid",
        product_domain,
        len(raw),
        len(validated),
    )

    if len(validated) < 3:
        logger.info(
            "Competitor analysis returned %s valid rows for %s — retrying with strict prompt",
            len(validated),
            product_domain,
        )
        retry_raw = await _request_competitors(
            url=normalized,
            scraped_content=scraped_content,
            product_info=product_info,
            company_category=company_category,
            company_name=company_name,
            strict=True,
        )
        retry_validated = _validate_competitors(retry_raw, product_domain=product_domain)
        if len(retry_validated) > len(validated):
            validated = retry_validated
        logger.info(
            "Competitor retry for %s: %s valid after strict prompt",
            product_domain,
            len(validated),
        )

    return _to_pipeline_competitors(validated)


def product_info_from_scrape(scrape: dict[str, Any]) -> str:
    """Lightweight product context from crawl metadata — used when full Groq docs are unavailable."""
    meta = scrape.get("metadata") or {}
    headings = scrape.get("headings") or {}
    parts: list[str] = []
    title = str(meta.get("title") or "").strip()
    if title:
        parts.append(f"Page title: {title}")
    for key in ("metaDescription", "ogDescription", "ogTitle"):
        val = str(meta.get(key) or "").strip()
        if val:
            parts.append(val)
    h1s = headings.get("h1") if isinstance(headings, dict) else None
    if isinstance(h1s, list) and h1s:
        parts.append("Primary headings: " + "; ".join(str(h) for h in h1s[:4]))
    keywords = str(meta.get("keywords") or "").strip()
    if keywords:
        parts.append(f"Keywords: {keywords}")
    return "\n".join(parts).strip()


def company_name_from_scrape(scrape: dict[str, Any], *, fallback: str) -> str:
    meta = scrape.get("metadata") or {}
    title = str(meta.get("title") or meta.get("ogTitle") or "").strip()
    if not title:
        return fallback
    name = title.split(" - ")[0].split(" | ")[0].split(" — ")[0].strip()
    if not name:
        return fallback
    lowered = name.lower()
    if lowered.startswith("www."):
        name = name[4:]
    if "." in name and name.count(" ") == 0:
        return fallback
    return name


def company_category_from_scrape(scrape: dict[str, Any]) -> str:
    meta = scrape.get("metadata") or {}
    keywords = str(meta.get("keywords") or "").strip()
    description = " ".join(
        filter(
            None,
            [
                str(meta.get("metaDescription") or ""),
                str(meta.get("ogDescription") or ""),
            ],
        )
    ).lower()
    blob = f"{keywords} {description}"
    category_hints: list[tuple[str, str]] = [
        ("payment", "Payment Processing"),
        ("payroll", "Payroll Software"),
        ("invoice", "Invoicing Software"),
        ("crm", "CRM Software"),
        ("marketing", "Marketing Software"),
        ("analytics", "Analytics Software"),
        ("ecommerce", "E-Commerce Platform"),
        ("e-commerce", "E-Commerce Platform"),
        ("ai ", "AI Software"),
        ("saas", "SaaS"),
    ]
    for needle, label in category_hints:
        if needle in blob:
            return label
    og_type = str(meta.get("ogType") or "").strip()
    if og_type and og_type.lower() not in {"website", "article"}:
        return og_type.title()
    return ""


async def ensure_market_competitors(
    url: str,
    scrape: dict[str, Any],
    analysis: dict[str, Any],
) -> tuple[list[dict[str, Any]], str]:
    """
    Return validated competitors and a status flag.
    Re-runs market research when the analysis payload has no scored competitors.
    """
    existing = analysis.get("competitors") or []
    if isinstance(existing, list) and existing:
        scored = [
            c
            for c in existing
            if isinstance(c, dict) and isinstance(c.get("similarityScore"), (int, float))
        ]
        if len(scored) >= 3:
            return existing, "complete"

    company = analysis.get("company") if isinstance(analysis.get("company"), dict) else {}
    domain = domain_from_url(normalize_url(url))
    company_name = str(company.get("name") or company_name_from_scrape(scrape, fallback=domain.split(".")[0].title()))
    company_category = str(company.get("category") or company_category_from_scrape(scrape) or "Unknown")

    product_info = product_info_from_analysis(analysis)
    if not product_info.strip():
        product_info = product_info_from_scrape(scrape)

    try:
        competitors = await identify_market_competitors(
            url,
            scrape,
            product_info=product_info,
            company_category=company_category,
            company_name=company_name,
        )
    except Exception as exc:
        from openai import RateLimitError

        if isinstance(exc, RateLimitError) or "rate limit" in str(exc).lower():
            logger.warning("Competitor research rate-limited for %s", domain)
            return [], "rate_limited"
        logger.warning("Competitor research failed for %s: %s", domain, exc)
        return [], "failed"

    if competitors:
        return competitors, "complete"
    return [], "empty"


def product_info_from_analysis(analysis: dict[str, Any]) -> str:
    """Build product context for competitor identification from a Groq analysis payload."""
    parts: list[str] = []
    company = analysis.get("company") or {}
    if isinstance(company, dict):
        if company.get("name"):
            parts.append(f"Company: {company['name']}")
        if company.get("category"):
            parts.append(f"Category: {company['category']}")
        if company.get("description"):
            parts.append(str(company["description"]))
        tags = company.get("tags")
        if isinstance(tags, list) and tags:
            parts.append("Tags: " + ", ".join(str(t) for t in tags[:12]))

    docs = analysis.get("documents") or {}
    if isinstance(docs, dict):
        product_doc = docs.get("productInfo")
        if isinstance(product_doc, str) and product_doc.strip():
            parts.append(product_doc.strip()[:3500])

    return "\n\n".join(parts).strip()
