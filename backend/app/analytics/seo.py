"""SEO issue detection and on-page content relevance metrics."""

from __future__ import annotations

import re
from typing import Any

_DOM_BYTES_PER_NODE = 171

_STOP_WORDS = frozenset({
    "the", "a", "an", "and", "or", "in", "on", "to", "for", "of", "your", "you",
    "it", "is", "are", "was", "were", "with", "that", "this", "let", "into", "from",
    "by", "as", "at", "be", "can", "will", "our", "we", "its", "their", "they",
    "have", "has", "had", "not", "but", "if", "when", "what", "how", "all", "any",
})

_META_DESC_BOILERPLATE = frozenset({
    "describe", "discover", "learn", "welcome", "official", "click", "here",
})


def _terms(text: str, *, min_len: int = 2) -> list[str]:
    return [
        w
        for w in re.findall(r"[a-z0-9]+", text.lower())
        if len(w) >= min_len and w not in _STOP_WORDS
    ]


def _term_in_corpus(term: str, corpus: str, corpus_terms: set[str]) -> bool:
    if term in corpus_terms:
        return True
    if len(term) >= 4 and term in corpus:
        return True
    return False


def _coverage_pct(source: str, corpus: str, *, min_len: int = 2, skip: frozenset[str] | None = None) -> int:
    skip = skip or frozenset()
    terms = [t for t in _terms(source, min_len=min_len) if t not in skip]
    if not terms:
        return 0
    corpus_terms = set(_terms(corpus, min_len=2))
    hits = sum(1 for term in terms if _term_in_corpus(term, corpus, corpus_terms))
    return int(100 * hits / len(terms))


def _build_corpus(scrape: dict[str, Any]) -> str:
    parts = [
        scrape.get("bodyText") or "",
        scrape.get("markdown") or "",
        " ".join(scrape.get("headings", {}).get("h1") or []),
        " ".join(scrape.get("headings", {}).get("h2") or []),
        " ".join(scrape.get("headings", {}).get("h3") or []),
    ]
    return " ".join(p for p in parts if p).strip()


def _visible_text_length(scrape: dict[str, Any]) -> int:
    body = scrape.get("bodyText") or ""
    markdown = scrape.get("markdown") or ""
    text = body if len(body) >= len(markdown) else markdown
    return len(re.sub(r"\s+", " ", text.strip()))


def _content_rate(text_chars: int, dom_elements: int) -> int:
    if dom_elements <= 0 or text_chars <= 0:
        return 0
    markup_bytes = dom_elements * _DOM_BYTES_PER_NODE
    rate = 100 * text_chars / markup_bytes
    return max(0, min(100, int(round(rate))))


def compute_content_relevance(
    scrape: dict[str, Any],
    lighthouse: dict[str, Any],
) -> dict[str, int]:
    metadata = scrape.get("metadata") or {}
    title = metadata.get("title") or metadata.get("ogTitle") or ""
    description = metadata.get("metaDescription") or metadata.get("ogDescription") or ""
    keywords = metadata.get("keywords") or ""

    corpus = _build_corpus(scrape)
    dom_elements = int(lighthouse.get("domElements") or 0)
    text_chars = _visible_text_length(scrape)

    keyword_relevance = 0
    if keywords.strip():
        keyword_relevance = _coverage_pct(keywords, corpus, min_len=3)

    return {
        "titleRelevance": _coverage_pct(title, corpus, min_len=2),
        "descriptionRelevance": _coverage_pct(
            description, corpus, min_len=3, skip=_META_DESC_BOILERPLATE
        ),
        "keywordRelevance": keyword_relevance,
        "contentRate": _content_rate(text_chars, dom_elements),
    }


def estimated_page_size_label(dom_elements: int) -> str | None:
    if dom_elements <= 0:
        return None
    size_bytes = dom_elements * _DOM_BYTES_PER_NODE
    if size_bytes >= 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    if size_bytes >= 1024:
        return f"{size_bytes // 1024} KB"
    return f"{size_bytes} B"


def build_seo_issues(
    *,
    lighthouse: dict[str, Any],
    word_count: int,
    content_rate: int,
    health: dict[str, Any] | None = None,
) -> list[dict[str, str]]:
    """Curated on-page issues aligned with production SEO audit tools."""
    issues: list[dict[str, str]] = []
    health = health or {}

    rb = lighthouse.get("renderBlocking") or {}
    has_render_blocking = lighthouse.get("hasRenderBlocking") or (
        (rb.get("blockingScripts") or 0) > 0 or (rb.get("blockingStylesheets") or 0) > 0
    )
    if has_render_blocking:
        issues.append({
            "type": "warning",
            "message": "Render-blocking resources detected",
            "impact": "high",
            "category": "Technical",
        })

    if content_rate < 15:
        issues.append({
            "type": "warning",
            "message": "Low content-to-code ratio",
            "impact": "medium",
            "category": "Content",
        })

    if word_count < 300:
        issues.append({
            "type": "warning",
            "message": "Low word count",
            "impact": "medium",
            "category": "Content",
        })

    canonical = health.get("canonicalUrl") or {}
    if not canonical.get("present"):
        issues.append({
            "type": "warning",
            "message": "Missing canonical URL",
            "impact": "medium",
            "category": "SEO",
        })

    return issues
