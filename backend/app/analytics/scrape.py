from __future__ import annotations

import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

from app.config.settings import settings
from app.analytics.utils import BROWSER_UA, normalize_url, resolve_analysis_url


def _meta(soup: BeautifulSoup, name: str | None = None, prop: str | None = None) -> str | None:
    if name:
        tag = soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    if prop:
        tag = soup.find("meta", attrs={"property": prop})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    return None


def _parse_html(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""

    h1 = [el.get_text(strip=True) for el in soup.find_all("h1") if el.get_text(strip=True)]
    h2 = [el.get_text(strip=True) for el in soup.find_all("h2") if el.get_text(strip=True)]
    h3 = [el.get_text(strip=True) for el in soup.find_all("h3") if el.get_text(strip=True)]

    body = soup.find("body")
    body_text = body.get_text(separator=" ", strip=True) if body else soup.get_text(separator=" ", strip=True)
    word_count = len(re.findall(r"\S+", body_text))

    canonical = soup.find("link", rel=lambda v: v and "canonical" in v.lower())
    html_el = soup.find("html")

    metadata = {
        "title": title,
        "metaDescription": _meta(soup, name="description") or "",
        "canonicalUrl": str(canonical["href"]).strip() if canonical and canonical.get("href") else "",
        "language": str(html_el.get("lang", "")).strip() if html_el else "",
        "wordCount": word_count,
        "keywords": _meta(soup, name="keywords") or "",
        "ogTitle": _meta(soup, prop="og:title") or "",
        "ogDescription": _meta(soup, prop="og:description") or "",
        "ogImage": _meta(soup, prop="og:image") or "",
        "ogType": _meta(soup, prop="og:type") or "",
        "twitterCard": _meta(soup, name="twitter:card") or "",
        "twitterTitle": _meta(soup, name="twitter:title") or "",
        "twitterSite": _meta(soup, name="twitter:site") or "",
        "twitterImage": _meta(soup, name="twitter:image") or "",
    }

    return {
        "metadata": metadata,
        "headings": {"h1": h1, "h2": h2, "h3": h3},
        "bodyText": body_text,
    }


def _size_label(size_bytes: int) -> str:
    if size_bytes >= 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    if size_bytes >= 1024:
        return f"{size_bytes // 1024} KB"
    if size_bytes > 0:
        return f"{size_bytes} B"
    return "—"


async def _fetch_page_response(url: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": BROWSER_UA})
            headers = res.headers
            encoding = (headers.get("content-encoding") or "br").strip()
            if encoding == "identity":
                encoding = "none"
            server = (headers.get("server") or headers.get("x-powered-by") or "Unknown").strip()
            cache_control = (headers.get("cache-control") or "").lower()
            cacheable = "no-store" not in cache_control and "private" not in cache_control
            size_bytes = len(res.content)
            return {
                "status": res.status_code,
                "server": server,
                "encoding": encoding,
                "pageSize": size_bytes,
                "pageSizeLabel": _size_label(size_bytes),
                "cacheable": cacheable,
                "html": res.text,
                "finalUrl": str(res.url).rstrip("/"),
            }
    except httpx.HTTPError:
        return {
            "status": 0,
            "server": "Unknown",
            "encoding": "—",
            "pageSize": 0,
            "pageSizeLabel": "—",
            "cacheable": True,
            "html": "",
            "finalUrl": url,
        }


def _merge_firecrawl_api_metadata(md_meta: dict[str, Any], fc_meta: dict[str, Any]) -> dict[str, Any]:
    """Map Firecrawl API metadata keys (incl. og:* / twitter:*) into our schema."""
    field_map = {
        "ogTitle": ("ogTitle", "og:title"),
        "ogDescription": ("ogDescription", "og:description"),
        "ogImage": ("ogImage", "og:image"),
        "ogType": ("ogType", "og:type"),
        "twitterCard": ("twitterCard", "twitter:card"),
        "twitterTitle": ("twitterTitle", "twitter:title"),
        "twitterSite": ("twitterSite", "twitter:site"),
        "twitterImage": ("twitterImage", "twitter:image"),
    }
    for target, sources in field_map.items():
        if md_meta.get(target):
            continue
        for src in sources:
            val = fc_meta.get(src)
            if val:
                md_meta[target] = str(val).strip()
                break
    return md_meta


async def _scrape_firecrawl(url: str) -> dict[str, Any] | None:
    key = settings.firecrawl_api_key.strip()
    if not key:
        return None

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(
            "https://api.firecrawl.dev/v1/scrape",
            headers={"Authorization": f"Bearer {key}"},
            json={"url": url, "formats": ["markdown", "html"]},
        )
        if res.status_code >= 400:
            return None
        payload = res.json()
        if not payload.get("success"):
            return None
        data = payload.get("data") or {}
        html = data.get("html") or ""
        markdown = data.get("markdown") or ""
        meta = data.get("metadata") or {}
        parsed = _parse_html(html) if html else {"metadata": {}, "headings": {"h1": [], "h2": [], "h3": []}, "bodyText": ""}
        md_meta = _merge_firecrawl_api_metadata(parsed["metadata"], meta)
        if meta.get("title"):
            md_meta["title"] = meta["title"]
        if meta.get("description"):
            md_meta["metaDescription"] = meta["description"]
        if meta.get("language") and not md_meta.get("language"):
            md_meta["language"] = str(meta["language"])
        if meta.get("sourceURL") and not md_meta.get("canonicalUrl"):
            md_meta["canonicalUrl"] = str(meta["sourceURL"])
        return {
            "markdown": markdown,
            "html": html,
            "metadata": md_meta,
            "headings": parsed["headings"],
            "bodyText": parsed.get("bodyText") or "",
            "source": "firecrawl",
        }


def _is_bot_challenge(metadata: dict[str, Any], html: str) -> bool:
    title = (metadata.get("title") or "").lower()
    if "security checkpoint" in title or "just a moment" in title:
        return True
    lower = html.lower()
    return "vercel security checkpoint" in lower or "checking your browser" in lower


async def scrape_website(url: str) -> dict[str, Any]:
    normalized = normalize_url(url)
    resolved = await resolve_analysis_url(normalized)
    response_info = await _fetch_page_response(resolved)

    firecrawl = await _scrape_firecrawl(resolved)

    direct_html = response_info.get("html") or ""
    parsed = _parse_html(direct_html) if direct_html else {
        "metadata": {},
        "headings": {"h1": [], "h2": [], "h3": []},
        "bodyText": "",
    }

    if firecrawl:
        fc_meta = firecrawl.get("metadata") or {}
        fc_html = firecrawl.get("html") or ""

        blocked = _is_bot_challenge(parsed.get("metadata") or {}, direct_html)
        if blocked:
            parsed = {
                "metadata": dict(firecrawl.get("metadata") or {}),
                "headings": firecrawl.get("headings") or {"h1": [], "h2": [], "h3": []},
                "bodyText": firecrawl.get("bodyText") or firecrawl.get("markdown") or "",
            }
            direct_html = fc_html or direct_html
        else:
            md_meta = parsed["metadata"]
            md_meta = _merge_firecrawl_api_metadata(md_meta, fc_meta)
            parsed["metadata"] = md_meta
            for key in ("title", "metaDescription", "canonicalUrl", "language", "keywords"):
                if not md_meta.get(key) and fc_meta.get(key):
                    md_meta[key] = fc_meta[key]
            if not parsed["headings"]["h1"] and firecrawl.get("headings", {}).get("h1"):
                parsed["headings"] = firecrawl["headings"]

        markdown = firecrawl.get("markdown") or ""
        html = direct_html or fc_html or ""
        md_meta = parsed["metadata"]
        if not md_meta.get("wordCount") and markdown:
            md_meta["wordCount"] = len(re.findall(r"\S+", markdown))
        if not parsed.get("bodyText") and markdown:
            parsed["bodyText"] = markdown

        return {
            "markdown": markdown,
            "html": html,
            "metadata": md_meta,
            "headings": parsed["headings"],
            "bodyText": parsed.get("bodyText") or firecrawl.get("bodyText") or "",
            "response": response_info,
            "requestedUrl": normalized,
            "analyzedUrl": response_info.get("finalUrl") or resolved,
            "source": "firecrawl",
        }

    if not parsed["metadata"].get("wordCount") and parsed.get("bodyText"):
        parsed["metadata"]["wordCount"] = len(re.findall(r"\S+", parsed["bodyText"]))

    return {
        "markdown": parsed.get("bodyText") or "",
        "html": direct_html,
        "metadata": parsed["metadata"],
        "headings": parsed["headings"],
        "bodyText": parsed.get("bodyText") or "",
        "response": response_info,
        "requestedUrl": normalized,
        "analyzedUrl": response_info.get("finalUrl") or resolved,
        "source": "direct",
    }
