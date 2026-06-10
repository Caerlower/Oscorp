"""Groq-generated company documents and markdown normalization."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from typing import Any

from app.config.settings import settings
from app.core.groq_client import get_groq_client
from app.analytics.competitors import (
    build_competitor_analysis_markdown,
    identify_market_competitors,
    product_info_from_analysis,
)
from app.analytics.utils import domain_from_url, normalize_url, parse_groq_json

logger = logging.getLogger(__name__)


_SECTIONS = (
    "Overview",
    "What It Does",
    "Product Category",
    "Product Type",
    "Target Customers",
    "Business Model",
    "Key Features",
    "Primary CTA",
    "Tech Signals",
    "Market Positioning",
    "Direct Competitors",
    "Differentiation Opportunities",
    "Content & SEO Angles",
    "Strategic Recommendations",
    "Brand Personality",
    "Tone Attributes",
    "Voice Principles",
    "Messaging Examples",
    "Vocabulary",
    "Channel Guidance",
    "Content Strategy",
    "Distribution Notes",
    "Ranked Channels",
    "Ideal Customer Profile (ICP)",
    "Positioning Statement",
    "Messaging Framework",
    "Channel Prioritization Report",
    "30-Day Roadmap",
    "Value Pillars",
    "Audience-Specific Hooks",
    "Objection Handling",
    "Headline",
    "Article 1",
    "Article 2",
    "Article 3",
)

_DOC_TITLES = (
    "Product Information",
    "Competitor Analysis",
    "Brand Voice",
    "Articles",
)

_FIELD_LABELS = (
    "Product Name:",
    "Website:",
    "One-liner:",
    "Product Type:",
    "Pricing:",
    "Positioning:",
    "Strengths:",
    "Weaknesses vs",
    "Weaknesses:",
    "Target keyword:",
    "Search intent:",
    "Summary:",
    "Primary:",
    "Secondary:",
    "Shared signals:",
    "Preferred words:",
    "Avoid:",
)

_SUBHEADS = ("Do", "Don't", "Headlines", "Social posts")


def _escape(s: str) -> str:
    return re.escape(s)


def _blank_line_before_heading_lines(text: str) -> str:
    lines = text.split("\n")
    result: list[str] = []
    for line in lines:
        if re.match(r"^#{1,3}\s", line) and result and result[-1].strip() != "":
            result.append("")
        result.append(line)
    return "\n".join(result)


def normalize_document_markdown(text: str) -> str:
    """Repair Groq markdown that lost newlines or heading markers."""
    if not text or not text.strip():
        return text

    out = text.strip().replace("\\n", "\n")

    out = re.sub(
        r"Product Name:\s*(.+?)\s+Website:\s*(\S+)\s+One-liner:\s*",
        r"Product Name: \1\n\nWebsite: \2\n\nOne-liner: ",
        out,
        flags=re.I,
    )

    out = re.sub(r"(?i)\btag:\s*", "\n- ", out)

    for title in _DOC_TITLES:
        out = re.sub(
            rf"^(?!#)\s*{_escape(title)}\s*$",
            f"# {title}",
            out,
            flags=re.M,
        )

    for section in _SECTIONS:
        out = re.sub(
            rf"^(?!#)\s*{_escape(section)}\s*$",
            f"## {section}",
            out,
            flags=re.M,
        )

    for sub in _SUBHEADS:
        out = re.sub(
            rf"^(?!#)\s*{_escape(sub)}\s*$",
            f"### {sub}",
            out,
            flags=re.M,
        )

    out = re.sub(r"^(?!#)(\d+\.\s+.+)$", r"## \1", out, flags=re.M)
    out = re.sub(r"^(?!#)(Week \d+ — .+)$", r"### \1", out, flags=re.M)

    for label in _FIELD_LABELS:
        out = re.sub(
            rf"(?<!\n)\s+({_escape(label)})",
            r"\n\n\1",
            out,
            flags=re.I,
        )

    out = re.sub(
        r"^Product Type:\s*(.+)$",
        r"## Product Type\n\n\1",
        out,
        flags=re.M,
    )

    out = _blank_line_before_heading_lines(out)
    out = re.sub(r"^(## [^\n]+)\n(?!\n)", r"\1\n\n", out, flags=re.M)

    out = re.sub(r"(?<!\n)\s+(- \*\*)", r"\n\1", out)
    out = re.sub(r"(?<!\n)\s+(- )", r"\n\1", out)
    out = re.sub(r"(?<!\n)\s+(\d+\.\s)", r"\n\1", out)
    out = re.sub(
        r"(?<!\n)\s+(Newcomers:|Power users:|Builders)",
        r"\n\n\1",
        out,
        flags=re.I,
    )

    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


ANALYSIS_PROMPT = """You are an expert marketing analyst and CMO. Analyze the website content and return ONLY valid JSON (no markdown fences, no commentary).

Website: {domain}
Analyzed URL: {url}
Content:
{markdown}

Return this JSON shape exactly:
{{
  "company": {{
    "name": "company name",
    "description": "3-4 sentence description",
    "category": "e.g. SaaS, Payment Service",
    "tags": ["tag1", "tag2", "tag3"]
  }},
  "documents": {{
    "productInfo": "<markdown string — see PRODUCT_INFO_TEMPLATE>",
    "competitorAnalysis": "<markdown string — see COMPETITOR_TEMPLATE>",
    "brandVoice": "<markdown string — see BRAND_VOICE_TEMPLATE>",
    "marketingStrategy": "<markdown string — see MARKETING_TEMPLATE>",
    "llmsTxt": "<markdown string — see LLMS_TXT_TEMPLATE>",
    "articles": "<markdown string — see ARTICLES_TEMPLATE>"
  }},
  "competitors": []
}}

Use the real company name, real website URL ({url}), and facts from the crawl only. Leave "competitors" as an empty array — direct competitors are identified in a dedicated market-research step.

Each document value must be a single markdown string using \\n for newlines inside JSON.

=== PRODUCT_INFO_TEMPLATE ===
Start with:
# Product Information

## Overview
- **Product Name:** ...
- **Website:** {url}
- **One-liner:** one sentence value prop

## What It Does
2-4 paragraphs explaining the product in plain language.

## Product Category
List 3-5 category tags as bullet lines (no hashtags).

## Product Type
SaaS / API / Marketplace / etc.

## Target Customers
Who buys this and why.

## Business Model
Pricing, free tier, monetization — say "not publicly available" if unknown.

## Key Features
Bullet list of 6-10 concrete features from the site.

## Primary CTA
Main call-to-action text.

## Tech Signals
Bullet list of tech stack, blockchain, integrations, deployment signals.

End with:
Generated on {generated_at}

=== COMPETITOR_TEMPLATE ===
# Competitor Analysis

Brief placeholder only — direct market competitors are generated in a dedicated research step after this JSON is returned. Write 2 sentences that the competitive landscape will be populated separately. Do not name specific competitor companies here.

Generated on {generated_at}

=== BRAND_VOICE_TEMPLATE ===
# Brand Voice

## Brand Personality
2-3 sentences.

## Tone Attributes
| Attribute | Description |
|-----------|-------------|
| ... | ... |

## Voice Principles
### Do
- bullet list

### Don't
- bullet list

## Messaging Examples
### Headlines
- 3 example headlines

### Social posts
- 2 short example posts in brand voice

## Vocabulary
**Preferred words:** ...
**Avoid:** ...

## Channel Guidance
Short notes for X, blog, docs, and community.

Generated on {generated_at}

=== MARKETING_TEMPLATE ===
# [Company Name] — Marketing Strategy Document

## 1. Ideal Customer Profile (ICP)
**Primary:** ...
**Secondary:** ...

## 2. Positioning Statement
One clear paragraph.

## 3. Messaging Framework
### Headline
Quote the site headline or propose one.

### Value Pillars
| Pillar | Message | Proof Point |
|--------|---------|-------------|
| ... | ... | ... |

### Audience-Specific Hooks
Bullets for newcomers, power users, builders.

### Objection Handling
Q&A style bullets.

## 4. Channel Prioritization Report
Ranked channels 1-6 with emoji priority, why, and first actions.

## 5. 30-Day Roadmap
### Week 1 — ...
### Week 2 — ...
### Week 3 — ...
### Week 4 — ...

Document prepared for [Company] — {domain} | Strategy optimized for a small team.

=== LLMS_TXT_TEMPLATE ===
Use standard llms.txt style (markdown):
# [Company Name]

> One-line description for LLMs.

One paragraph expanding what the product does.

## Product
- [Home]({url}): Short label

## Docs
- Add doc links if known from crawl, else omit section

## Optional
- [Sitemap]({url}/sitemap.xml): XML sitemap if plausible

=== ARTICLES_TEMPLATE ===
# Articles

Content pipeline and SEO article plan for {domain}.

## Content Strategy
2-3 sentences on themes and search intent.

## Article 1: [Title]
- **Target keyword:** ...
- **Search intent:** informational / commercial
- **Summary:** 2 sentences
- **Outline:**
  1. Section one
  2. Section two
  3. Section three

## Article 2: [Title]
(same structure)

## Article 3: [Title]
(same structure)

## Distribution Notes
Where to publish and how to repurpose.

Generated on {generated_at}"""

DOC_KEYS = (
    "productInfo",
    "competitorAnalysis",
    "brandVoice",
    "marketingStrategy",
    "llmsTxt",
    "articles",
)


async def generate_company_documents(
    url: str,
    scrape: dict[str, Any],
    *,
    company_context: str = "",
) -> dict[str, Any]:
    if not settings.groq_api_key.strip():
        raise ValueError("GROQ_API_KEY is required for website analysis")

    domain = domain_from_url(url)
    normalized = normalize_url(url)
    markdown = (scrape.get("markdown") or "")[:8000]
    generated_at = datetime.now(UTC).isoformat()

    extra = f"\n\n{company_context}\n" if company_context else ""
    prompt = ANALYSIS_PROMPT.format(
        domain=domain,
        url=normalized,
        markdown=markdown,
        generated_at=generated_at,
        company=domain.split(".")[0].title(),
    ) + extra

    client = get_groq_client()
    completion = await client.chat.completions.create(
        model=settings.groq_model,
        max_tokens=5000,
        messages=[
            {
                "role": "system",
                "content": "You return only valid JSON. Escape newlines in string values properly.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.35,
    )
    text = completion.choices[0].message.content or "{}"
    result = parse_groq_json(text)

    docs = result.get("documents") or {}
    for key in DOC_KEYS:
        if isinstance(docs.get(key), str):
            docs[key] = normalize_document_markdown(docs[key].strip())

    company = result.get("company") or {}
    company_name = company.get("name") or domain.split(".")[0].title()
    company_category = str(company.get("category") or "").strip()
    try:
        competitors = await identify_market_competitors(
            normalized,
            scrape,
            product_info=product_info_from_analysis(result),
            company_category=company_category,
            company_name=str(company_name),
        )
        result["competitors"] = competitors
        docs["competitorAnalysis"] = normalize_document_markdown(
            build_competitor_analysis_markdown(
                competitors,
                company_name=company_name,
                url=normalized,
                generated_at=generated_at,
            )
            if competitors
            else (
                f"# Competitor Analysis\n\n"
                f"Market research for **{company_name}** did not return enough direct competitors. "
                f"Re-run analysis when Groq quota is available.\n\n"
                f"Generated on {generated_at}"
            )
        )
    except Exception as exc:
        logger.warning("Dedicated competitor analysis failed for %s: %s", domain, exc)
        result["competitors"] = []
        docs["competitorAnalysis"] = normalize_document_markdown(
            f"# Competitor Analysis\n\n"
            f"Competitor research failed: {exc}\n\n"
            f"Generated on {generated_at}"
        )

    result["documents"] = docs
    return result


analyze_content = generate_company_documents
