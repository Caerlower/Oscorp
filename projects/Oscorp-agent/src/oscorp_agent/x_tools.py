from __future__ import annotations

import httpx

from oscorp_agent.browser.session import post_to_x_via_browser
from oscorp_agent.config import Settings


async def publish_x_post(*, settings: Settings, text: str) -> dict:
    if settings.x_posting_mode == "browser":
        return await post_to_x_via_browser(settings=settings, content=text)
    if settings.x_posting_mode != "live":
        return {
            "status": "dry_run",
            "channel": "X",
            "text": text,
        }
    if not settings.x_access_token:
        return {
            "status": "error",
            "error": "X_ACCESS_TOKEN is required when X_POSTING_MODE=live",
        }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.x.com/2/tweets",
            headers={"Authorization": f"Bearer {settings.x_access_token}"},
            json={"text": text},
        )
        if response.status_code not in (200, 201):
            return {
                "status": "error",
                "code": response.status_code,
                "body": response.text,
            }
        return {
            "status": "posted",
            "channel": "X",
            "data": response.json(),
        }
