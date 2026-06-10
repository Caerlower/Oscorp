from __future__ import annotations

import re
from typing import Any, Literal

import httpx

from app.config.settings import settings
from app.analytics.utils import normalize_url, resolve_analysis_url

VitalStatus = Literal["pass", "warn", "fail"]


def _score_pct(categories: dict, key: str) -> int:
    cat = categories.get(key) or {}
    score = cat.get("score")
    if score is None:
        return 0
    return int(round(float(score) * 100))


def _audit(audits: dict, key: str) -> dict:
    return audits.get(key) or {}


def _parse_ms(display: str) -> float | None:
    if not display:
        return None
    s = display.strip().lower().replace("\xa0", " ")
    if s.endswith("ms"):
        try:
            return float(s.replace("ms", "").strip())
        except ValueError:
            return None
    if s.endswith("s"):
        try:
            return float(s.replace("s", "").strip()) * 1000
        except ValueError:
            return None
    return None


def _status_lcp(seconds: float | None) -> VitalStatus:
    if seconds is None:
        return "warn"
    if seconds < 2.5:
        return "pass"
    if seconds < 4:
        return "warn"
    return "fail"


def _status_fcp(seconds: float | None) -> VitalStatus:
    if seconds is None:
        return "warn"
    if seconds < 1.8:
        return "pass"
    if seconds < 3:
        return "warn"
    return "fail"


def _status_tbt(ms: float | None) -> VitalStatus:
    if ms is None:
        return "warn"
    if ms < 200:
        return "pass"
    if ms < 600:
        return "warn"
    return "fail"


def _status_cls(value: float | None) -> VitalStatus:
    if value is None:
        return "warn"
    if value < 0.1:
        return "pass"
    if value < 0.25:
        return "warn"
    return "fail"


def _fmt_vital_display(audit_id: str, audit: dict) -> str:
    """Format metrics the same way Lighthouse UI does (from numericValue)."""
    raw = audit.get("numericValue")
    if raw is None:
        return str(audit.get("displayValue") or "—").replace("\xa0", " ")

    if audit_id == "cumulative-layout-shift":
        value = float(raw)
        if value < 0.001:
            return "0"
        text = f"{value:.3f}".rstrip("0").rstrip(".")
        return text

    ms = float(raw)
    if audit_id == "total-blocking-time":
        rounded = int(round(ms))
        return "0 ms" if rounded <= 0 else f"{rounded} ms"

    seconds = ms / 1000
    if seconds >= 0.1:
        return f"{seconds:.1f} s"
    return f"{int(round(ms))} ms"


def _vital_from_audit(audits: dict, audit_id: str) -> dict[str, str]:
    audit = _audit(audits, audit_id)
    display = _fmt_vital_display(audit_id, audit)

    raw = audit.get("numericValue")
    if audit_id == "largest-contentful-paint":
        sec = float(raw) / 1000 if raw is not None else _parse_ms(display)
        if sec is not None and sec > 10:
            sec /= 1000
        status = _status_lcp(sec if isinstance(sec, float) else None)
    elif audit_id == "first-contentful-paint":
        sec = float(raw) / 1000 if raw is not None else _parse_ms(display)
        if sec is not None and sec > 10:
            sec /= 1000
        status = _status_fcp(sec if isinstance(sec, float) else None)
    elif audit_id == "total-blocking-time":
        ms = float(raw) if raw is not None else _parse_ms(display)
        status = _status_tbt(ms)
    elif audit_id == "cumulative-layout-shift":
        cls = float(raw) if raw is not None else None
        status = _status_cls(cls)
    elif audit_id in {"speed-index", "interactive"}:
        sec = float(raw) / 1000 if raw is not None else _parse_ms(display)
        if sec is not None and sec > 10:
            sec /= 1000
        status = _status_lcp(sec if isinstance(sec, float) else None)
    else:
        status = "pass"

    return {"value": display, "status": status}


def _status_timing_ms(ms: float | None, pass_max: float, warn_max: float) -> VitalStatus:
    if ms is None:
        return "warn"
    if ms <= pass_max:
        return "pass"
    if ms <= warn_max:
        return "warn"
    return "fail"


def _fmt_ms(ms: float | None) -> str:
    if ms is None:
        return "—"
    if ms >= 1000:
        return f"{ms / 1000:.1f} s"
    rounded = int(round(ms))
    return "0 ms" if rounded <= 0 else f"{rounded} ms"


def _metric_timing(audit: dict, pass_max: float, warn_max: float) -> dict[str, str]:
    raw = audit.get("numericValue")
    ms = float(raw) if raw is not None else _parse_ms(str(audit.get("displayValue") or ""))
    audit_id = str(audit.get("id") or "")
    display = _fmt_vital_display(audit_id, audit) if audit_id else _fmt_ms(ms)
    return {"value": display, "status": _status_timing_ms(ms, pass_max, warn_max)}


def _extract_server_timing(audits: dict) -> dict[str, dict[str, str]]:
    metrics = _audit(audits, "metrics")
    details = metrics.get("details") or {}
    items = details.get("items") or [{}]
    item = items[0] if items else {}

    dom_complete_ms = item.get("observedDomContentLoaded")
    if dom_complete_ms is None:
        dom_complete_ms = item.get("domContentLoaded")

    download_ms = item.get("observedLoad")
    if download_ms is not None and dom_complete_ms is not None:
        download_ms = max(0.0, float(download_ms) - float(dom_complete_ms))

    ttfb_audit = _audit(audits, "server-response-time")

    return {
        "timeToInteractive": _metric_timing(_audit(audits, "interactive"), 3800, 7300),
        "domComplete": {
            "value": _fmt_ms(float(dom_complete_ms)) if dom_complete_ms is not None else "—",
            "status": _status_timing_ms(
                float(dom_complete_ms) if dom_complete_ms is not None else None,
                1500,
                3000,
            ),
        },
        "connection": _metric_timing(_audit(audits, "network-rtt"), 150, 300),
        "tlsHandshake": _metric_timing(_audit(audits, "network-server-latency"), 200, 400),
        "ttfb": _metric_timing(ttfb_audit, 800, 1800),
        "download": {
            "value": _fmt_ms(float(download_ms)) if download_ms is not None else "—",
            "status": _status_timing_ms(
                float(download_ms) if download_ms is not None else None,
                500,
                1500,
            ),
        },
    }


def _issues_from_audits(audits: dict, categories: dict) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    seen: set[str] = set()

    priority_ids = {
        "render-blocking-resources": ("Render-blocking resources detected", "Technical", "high"),
        "document-title": ("Document does not have a title", "SEO", "high"),
        "meta-description": ("Document does not have a meta description", "SEO", "medium"),
        "is-crawlable": ("Page is not crawlable", "SEO", "high"),
        "viewport": ("Page is not mobile friendly", "SEO", "high"),
        "unused-javascript": ("Reduce unused JavaScript", "Technical", "medium"),
        "unused-css-rules": ("Reduce unused CSS", "Technical", "medium"),
        "total-byte-weight": ("Page weight is too large", "Technical", "medium"),
        "dom-size": ("DOM size is too large", "Technical", "medium"),
        "link-text": ("Links do not have descriptive text", "SEO", "medium"),
    }

    for audit_id, (message, category, impact) in priority_ids.items():
        audit = _audit(audits, audit_id)
        score = audit.get("score")
        if score is not None and float(score) < 1 and message not in seen:
            seen.add(message)
            issues.append({
                "type": "warning" if impact != "high" else "error",
                "message": message,
                "impact": impact,
                "category": category,
            })

    return issues[:8]


def _extract_strategy(data: dict) -> dict[str, Any]:
    lr = data.get("lighthouseResult") or {}
    categories = lr.get("categories") or {}
    audits = lr.get("audits") or {}

    scores = {
        "performance": _score_pct(categories, "performance"),
        "accessibility": _score_pct(categories, "accessibility"),
        "bestPractices": _score_pct(categories, "best-practices"),
        "seo": _score_pct(categories, "seo"),
    }

    core = {
        "lcp": _vital_from_audit(audits, "largest-contentful-paint"),
        "fcp": _vital_from_audit(audits, "first-contentful-paint"),
        "tbt": _vital_from_audit(audits, "total-blocking-time"),
        "cls": _vital_from_audit(audits, "cumulative-layout-shift"),
        "si": _vital_from_audit(audits, "speed-index"),
        "tti": _vital_from_audit(audits, "interactive"),
    }

    rb = _audit(audits, "render-blocking-resources")
    if not rb.get("details"):
        rb = _audit(audits, "render-blocking-insight")
    rb_details = rb.get("details") or {}
    rb_items = rb_details.get("items") or []
    rb_urls: list[str] = []
    blocking_scripts = 0
    blocking_stylesheets = 0
    for item in rb_items:
        url = str(item.get("url") or "")
        if url:
            rb_urls.append(url)
        resource_type = str(item.get("resourceType") or item.get("mimeType") or "").lower()
        if "script" in resource_type or url.endswith(".js"):
            blocking_scripts += 1
        elif "stylesheet" in resource_type or ".css" in url:
            blocking_stylesheets += 1

    rb_score = rb.get("score")
    has_render_blocking = (
        rb_score is not None and float(rb_score) < 1
    ) or blocking_scripts > 0 or blocking_stylesheets > 0

    dom = _audit(audits, "dom-size")
    ttfb_audit = _audit(audits, "server-response-time")
    cache_audit = _audit(audits, "uses-long-cache-ttl")
    viewport = _audit(audits, "viewport")
    byte_weight = _audit(audits, "total-byte-weight")
    byte_bytes = int(byte_weight.get("numericValue") or 0)
    if byte_bytes >= 1024 * 1024:
        lh_page_size = f"{byte_bytes / (1024 * 1024):.1f} MB"
    elif byte_bytes >= 1024:
        lh_page_size = f"{byte_bytes // 1024} KB"
    elif byte_bytes > 0:
        lh_page_size = f"{byte_bytes} B"
    else:
        lh_page_size = "—"

    dom_nodes = int(dom.get("numericValue") or 0)
    dom_insight = _audit(audits, "dom-size-insight")
    insight_items = (dom_insight.get("details") or {}).get("items") or []
    for item in insight_items:
        if str(item.get("statistic") or "").lower() == "total elements":
            val = (item.get("value") or {}).get("value")
            if isinstance(val, (int, float)) and val > 0:
                dom_nodes = int(val)
                break
    if dom_nodes <= 0:
        debug = (dom_insight.get("details") or {}).get("debugData") or {}
        total = debug.get("totalElements")
        if isinstance(total, (int, float)) and total > 0:
            dom_nodes = int(total)

    dom_label = f"{dom_nodes:,} nodes" if dom_nodes else "—"

    mobile_friendly = viewport.get("score") == 1 if viewport.get("score") is not None else True

    return {
        "scores": scores,
        "coreWebVitals": core,
        "issues": _issues_from_audits(audits, categories),
        "renderBlocking": {
            "blockingScripts": blocking_scripts,
            "blockingStylesheets": blocking_stylesheets,
            "urls": rb_urls[:20],
        },
        "hasRenderBlocking": has_render_blocking,
        "serverTiming": _extract_server_timing(audits),
        "ttfb": int(ttfb_audit.get("numericValue") or 0),
        "domSize": dom_nodes,
        "domSizeLabel": dom_label,
        "pageSizeLabel": lh_page_size,
        "pageSizeBytes": byte_bytes,
        "cacheable": cache_audit.get("score") == 1 if cache_audit.get("score") is not None else True,
        "mobileFriendly": mobile_friendly,
        "onPageScore": scores["seo"],
        "finalUrl": lr.get("finalUrl") or "",
        "lighthouseVersion": lr.get("lighthouseVersion") or "",
        "domElements": dom_nodes,
    }


async def _run_pagespeed(url: str, strategy: str) -> dict[str, Any]:
    params: list[tuple[str, str]] = [
        ("url", url),
        ("strategy", strategy),
        ("category", "performance"),
        ("category", "accessibility"),
        ("category", "best-practices"),
        ("category", "seo"),
    ]
    key = settings.pagespeed_api_key.strip()
    if key:
        params.append(("key", key))

    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.get(
            "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
            params=params,
        )
        res.raise_for_status()
        return _extract_strategy(res.json())


async def run_lighthouse(url: str) -> dict[str, Any]:
    normalized = normalize_url(url)
    resolved = await resolve_analysis_url(normalized)

    import asyncio

    mobile, desktop = await asyncio.gather(
        _run_pagespeed(resolved, "mobile"),
        _run_pagespeed(resolved, "desktop"),
    )

    issues = {i["message"]: i for i in mobile.get("issues", []) + desktop.get("issues", [])}.values()

    return {
        "requestedUrl": normalized,
        "analyzedUrl": desktop.get("finalUrl") or resolved,
        "mobile": mobile["scores"],
        "desktop": desktop["scores"],
        "coreWebVitals": {
            "desktop": desktop["coreWebVitals"],
            "mobile": mobile["coreWebVitals"],
        },
        "issues": list(issues),
        "renderBlocking": desktop["renderBlocking"],
        "serverTiming": desktop["serverTiming"],
        "ttfb": desktop["ttfb"],
        "domSize": desktop["domSize"],
        "domSizeLabel": desktop["domSizeLabel"],
        "pageSizeLabel": desktop["pageSizeLabel"],
        "pageSizeBytes": desktop["pageSizeBytes"],
        "cacheable": desktop["cacheable"],
        "mobileFriendly": mobile["mobileFriendly"],
        "onPageScore": desktop["onPageScore"],
        "lighthouseVersion": desktop.get("lighthouseVersion") or "",
        "hasRenderBlocking": desktop.get("hasRenderBlocking", False),
        "domElements": desktop.get("domElements") or 0,
    }
