from __future__ import annotations

from typing import Any

from app.analytics.company import format_company_context_block, parse_company_profile

_DOC_KEYS = (
    ("productInfo", "Product information"),
    ("competitorAnalysis", "Competitor analysis"),
    ("brandVoice", "Brand voice"),
    ("marketingStrategy", "Marketing strategy"),
    ("llmsTxt", "llms.txt"),
    ("articles", "Articles library"),
)


def _truncate(text: str, max_len: int = 2800) -> str:
    cleaned = str(text or "").strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[:max_len] + "\n…[truncated for context window]"


def _seo_summary(analysis: dict[str, Any]) -> str:
    seo = analysis.get("seo") or {}
    health = seo.get("health") or {}
    mobile = (seo.get("pagespeed") or {}).get("mobile") or {}
    desktop = (seo.get("pagespeed") or {}).get("desktop") or {}
    issues = seo.get("issues") or []
    lines = [
        f"Analyzed URL: {analysis.get('analyzedUrl') or analysis.get('domain') or '—'}",
        f"Mobile PageSpeed — perf {mobile.get('performance', '—')}, SEO {mobile.get('seo', '—')}",
        f"Desktop PageSpeed — perf {desktop.get('performance', '—')}, SEO {desktop.get('seo', '—')}",
    ]
    if health:
        meta = health.get("metaDescription") or {}
        lines.append(
            f"Meta description: {'present' if meta.get('present') else 'missing'}"
            + (f" ({meta.get('length', len(str(meta.get('value', ''))))} chars)" if meta.get("present") else "")
        )
        lines.append(f"Word count: {health.get('wordCount', '—')} · Readability: {health.get('readability', '—')}")
        lines.append(f"Mobile friendly: {health.get('mobileFriendly', '—')}")
    if issues:
        lines.append("Top SEO issues:")
        for issue in issues[:6]:
            if isinstance(issue, dict):
                lines.append(f"- {issue.get('message', issue)}")
    return "\n".join(lines)


def _technical_summary(analysis: dict[str, Any]) -> str:
    tech = analysis.get("technical") or {}
    if not tech:
        return ""
    server = tech.get("server") or {}
    return "\n".join(
        [
            f"On-page score: {tech.get('onPageScore', '—')}",
            f"Server: {server.get('name', '—')} · Status {server.get('status', '—')}",
            f"TTFB: {tech.get('ttfb', '—')}ms · DOM size: {tech.get('domSize', '—')}",
        ]
    )


def _competitors_summary(analysis: dict[str, Any]) -> str:
    rows = analysis.get("competitors") or []
    if not rows:
        return ""
    lines = ["Competitors:"]
    for row in rows[:8]:
        if not isinstance(row, dict):
            continue
        name = row.get("name") or row.get("domain") or "Unknown"
        domain = row.get("domain") or ""
        desc = row.get("description") or ""
        line = f"- {name}"
        if domain:
            line += f" ({domain})"
        if desc:
            line += f": {desc}"
        lines.append(line)
    return "\n".join(lines)


def build_cmo_context_block(
    *,
    site: str,
    company_name: str,
    company_profile: dict[str, Any] | None,
    analysis: dict[str, Any] | None,
) -> str:
    parts: list[str] = []

    if site or company_name:
        parts.append(f"## Workspace\n- Company: {company_name or 'Unknown'}\n- Site: {site or '—'}")

    profile = parse_company_profile(company_profile)
    profile_block = format_company_context_block(profile)
    if profile_block:
        parts.append(f"## Company profile\n{profile_block}")

    if not analysis:
        parts.append("## Site analysis\nNo live analysis loaded yet. Answer from general marketing best practices and note missing data.")
        return "\n\n".join(parts)

    company = analysis.get("company") or {}
    if company:
        desc = _truncate(str(company.get("description") or ""), 1200)
        tags = company.get("tags") or []
        category = company.get("category") or ""
        block = [f"Name: {company.get('name') or company_name}"]
        if category:
            block.append(f"Category: {category}")
        if tags:
            block.append("Tags: " + ", ".join(str(t) for t in tags[:12]))
        if desc:
            block.append(f"Description: {desc}")
        parts.append("## Company (from analysis)\n" + "\n".join(block))

    docs = analysis.get("documents") or {}
    doc_sections: list[str] = []
    for key, label in _DOC_KEYS:
        raw = docs.get(key)
        if raw and str(raw).strip():
            doc_sections.append(f"### {label}\n{_truncate(str(raw))}")
    if doc_sections:
        parts.append("## Company documents\n" + "\n\n".join(doc_sections))

    seo = _seo_summary(analysis)
    if seo:
        parts.append(f"## SEO & PageSpeed\n{seo}")

    technical = _technical_summary(analysis)
    if technical:
        parts.append(f"## Technical\n{technical}")

    competitors = _competitors_summary(analysis)
    if competitors:
        parts.append(competitors)

    social = analysis.get("socialTags") or {}
    if isinstance(social, dict) and any(social.values()):
        social_lines = [f"{k}: {v}" for k, v in social.items() if v]
        parts.append("## Social metadata\n" + "\n".join(social_lines[:8]))

    ai_status = (analysis.get("aiAnalysis") or {}).get("status")
    if ai_status == "rate_limited":
        parts.append(
            "## Note\nGroq rate limit hit during last analysis refresh — SEO/technical data is live; some AI-generated docs may be placeholders."
        )

    return "\n\n".join(parts)


def build_cmo_system_prompt(context_block: str) -> str:
    return f"""You are Oscorp, an expert AI Chief Marketing Officer embedded in the user's marketing terminal.
You have access to their live website analysis, company documents, SEO metrics, competitors, and brand context below.

Behavior:
- Ground answers in the provided context; cite specific metrics, doc sections, or competitors when relevant
- If context is missing for a question, say what you would need and still give practical next steps
- Tone: sharp operator, plain language, no hype or filler
- You help with strategy, SEO fixes, content ideas, positioning, channel plans, and interpreting their docs
- Do not claim to have posted content or run agents — you advise; agents in the dashboard execute

CRITICAL FORMATTING RULES:
- Never use markdown headers (no ##, no bold section titles like 'Key Message:')
- Never use nested bullet points
- Write like a smart CMO texting their founder — direct, punchy, no fluff
- Max 3-4 short paragraphs per response
- If listing items use a simple dash (-) list, max 4 items
- No 'Call to Action:', 'Supporting Points:', 'Visuals:' labels ever
- Start responses directly with the insight, not with a greeting or preamble

{context_block}"""
