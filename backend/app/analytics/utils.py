from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.json_utils import parse_groq_json

BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_PARKING_HINTS = (
    "godaddy.com/forsale",
    "forsale.godaddy.com",
    "sedoparking.com",
    "hugedomains.com",
    "dan.com/buy-domain",
    "parked",
)


def normalize_url(url: str) -> str:
    raw = url.strip()
    if not raw:
        raise ValueError("URL is required")
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if not parsed.netloc:
        raise ValueError("Invalid URL")
    return raw.rstrip("/")


def _is_parking(final_url: str, body_len: int, title: str) -> bool:
    lower = final_url.lower()
    if any(h in lower for h in _PARKING_HINTS):
        return True
    if body_len < 500 and ("for sale" in title.lower() or "domain" in title.lower()):
        return True
    return False


def _title_from_html(html: str) -> str:
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    return match.group(1).strip() if match else ""


async def _probe_url(url: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        res = await client.get(url, headers={"User-Agent": BROWSER_UA})
        final = str(res.url).rstrip("/")
        html = res.text
        return {
            "url": final,
            "status": res.status_code,
            "bodyLen": len(res.content),
            "title": _title_from_html(html),
            "headers": dict(res.headers),
            "html": html,
        }


async def resolve_analysis_url(url: str) -> str:
    """
    Follow redirects and prefer a live site over domain-parking pages.
    PageSpeed and scrapers must use the same resolved URL Lighthouse would load.
    """
    normalized = normalize_url(url)
    candidates: list[str] = [normalized]
    parsed = urlparse(normalized)
    host = parsed.netloc
    if host.startswith("www."):
        candidates.append(f"{parsed.scheme}://{host[4:]}")
    else:
        candidates.append(f"{parsed.scheme}://www.{host}")

    best: dict[str, Any] | None = None
    for candidate in candidates:
        try:
            probe = await _probe_url(candidate)
        except httpx.HTTPError:
            continue
        if probe["status"] >= 400:
            continue
        parking = _is_parking(probe["url"], probe["bodyLen"], probe["title"])
        probe["parking"] = parking
        if best is None:
            best = probe
            continue
        if best.get("parking") and not parking:
            best = probe
            continue
        if not best.get("parking") and not parking and probe["bodyLen"] > best["bodyLen"]:
            best = probe

    if best and not best.get("parking"):
        return best["url"]

    # Fall back to first successful probe even if parking (caller may surface a warning).
    if best:
        return best["url"]
    return normalized


def domain_from_url(url: str) -> str:
    return urlparse(normalize_url(url)).netloc.replace("www.", "")


def favicon_url(domain: str) -> str:
    clean = domain.replace("https://", "").replace("http://", "").split("/")[0]
    return f"https://www.google.com/s2/favicons?domain={clean}&sz=64"
