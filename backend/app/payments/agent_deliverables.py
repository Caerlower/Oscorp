from __future__ import annotations

import logging
from datetime import UTC, date, datetime

from app.agents.articles.agent import run_articles_agent
from app.agents.articles.schemas import ArticlesRequest, ArticlesResponse
from app.agents.hackernews.agent import run_hackernews_agent
from app.agents.hackernews.schemas import HackerNewsRequest, HackerNewsResponse
from app.agents.linkedin.agent import run_linkedin_agent
from app.agents.linkedin.schemas import LinkedInRequest, LinkedInResponse
from app.agents.twitter.agent import run_twitter_agent
from app.agents.twitter.schemas import MAX_TWEETS, TwitterRequest, TwitterResponse
from app.db.supabase_client import SupabaseError, supabase

logger = logging.getLogger(__name__)


def _utc_today() -> str:
    return datetime.now(UTC).date().isoformat()


def _created_on_utc_day(created: str, day: str) -> bool:
    raw = str(created or "").strip()
    if not raw:
        return False
    try:
        normalized = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC).date().isoformat() == day
    except ValueError:
        return raw[:10] == day


def _deliverable_to_tweet(row: dict) -> dict:
    content = row.get("content") or {}
    return {
        "id": row["id"],
        "text": content.get("text", ""),
        "characterCount": content.get("characterCount", 0),
        "intentUrl": content.get("intentUrl", ""),
        "status": row.get("status", "pending"),
        "slotIndex": row.get("slot_index", 0),
    }


async def sync_twitter_deliverables(user_id: str, body: TwitterRequest) -> list[dict]:
    """
    Return today's pending tweets. Generate up to MAX_TWEETS per UTC day when needed.
    Once all slots for the day are posted, returns [] until the next day.
    """
    if not supabase.enabled:
        raise SupabaseError("Supabase is required for agent deliverables")

    today = _utc_today()
    all_today = await supabase.list_agent_deliverables(
        user_id,
        agent="twitter",
        deliverable_date=today,
    )
    pending = [row for row in all_today if row.get("status") == "pending"]
    if pending:
        return [_deliverable_to_tweet(row) for row in pending]

    if len(all_today) >= MAX_TWEETS:
        return []

    needed = MAX_TWEETS - len(all_today)
    result = await run_twitter_agent(body)
    if isinstance(result, dict) and "error" in result:
        raise RuntimeError(result["error"])
    if not isinstance(result, TwitterResponse) or not result.tweets:
        raise RuntimeError("Twitter agent returned no tweets")

    start_slot = len(all_today)
    inserted: list[dict] = []
    for offset, tweet in enumerate(result.tweets[:needed]):
        row = await supabase.insert_agent_deliverable(
            {
                "user_id": user_id,
                "agent": "twitter",
                "slot_index": start_slot + offset,
                "content": {
                    "text": tweet.text,
                    "characterCount": tweet.characterCount,
                    "intentUrl": tweet.intentUrl,
                },
                "status": "pending",
                "deliverable_date": today,
            }
        )
        inserted.append(_deliverable_to_tweet(row))

    return inserted


PAID_AGENT_DAILY_LIMIT: dict[str, int] = {
    "articles": 1,
    "linkedin": 1,
    "hackernews": 1,
}


def _row_content(row: dict) -> dict:
    content = row.get("content")
    return content if isinstance(content, dict) else {}


def _format_saved_item(row: dict) -> dict:
    return {**_row_content(row), "id": row["id"]}


async def _get_today_slot_deliverable(user_id: str, agent: str, slot_index: int) -> dict | None:
    """Row for this UTC day + slot, any status (pending or posted)."""
    today = _utc_today()
    rows = await supabase.list_agent_deliverables(
        user_id,
        agent=agent,
        deliverable_date=today,
    )
    for row in rows:
        if int(row.get("slot_index", 0)) == slot_index:
            return row
    return None


def _is_unique_violation(exc: SupabaseError) -> bool:
    msg = str(exc)
    return "409" in msg or "23505" in msg


async def get_pending_paid_deliverable(user_id: str, agent: str) -> dict | list[dict] | None:
    """Return pending paid-agent output for today (UTC), else any older pending slot."""
    if agent not in PAID_AGENT_DAILY_LIMIT:
        return None

    def _items_from_rows(rows: list[dict]) -> dict | list[dict] | None:
        if not rows:
            return None
        items = [{**_row_content(row), "id": row["id"]} for row in rows]
        if agent in ("articles", "linkedin"):
            return items[0] if items else None
        return items

    today = _utc_today()
    today_rows = await supabase.list_agent_deliverables(
        user_id,
        agent=agent,
        deliverable_date=today,
        status="pending",
        limit=PAID_AGENT_DAILY_LIMIT[agent],
    )
    today_pending = _items_from_rows(today_rows)
    if today_pending:
        return today_pending

    rows = await supabase.list_agent_deliverables(
        user_id,
        agent=agent,
        status="pending",
        limit=PAID_AGENT_DAILY_LIMIT[agent],
    )
    return _items_from_rows(rows)


# Backward-compatible alias used by save/restore paths.
async def get_today_paid_deliverable(user_id: str, agent: str) -> dict | list[dict] | None:
    return await get_pending_paid_deliverable(user_id, agent)


def _parse_iso_dt(value: str | None) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        normalized = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    except ValueError:
        return None


async def _latest_posted_at(user_id: str, agent: str) -> datetime | None:
    rows = await supabase.list_agent_deliverables(
        user_id,
        agent=agent,
        status="posted",
        limit=20,
    )
    latest: datetime | None = None
    for row in rows:
        posted = _parse_iso_dt(str(row.get("posted_at") or ""))
        if posted and (latest is None or posted > latest):
            latest = posted
    return latest


async def has_unfulfilled_payment_since_last_post(user_id: str, agent: str) -> bool:
    """
    True when the user paid for a new slot but content was not saved yet
    (e.g. navigation before persistence). False after mark-complete with no new payment.
    """
    pending = await get_pending_paid_deliverable(user_id, agent)
    if pending:
        return False

    last_posted = await _latest_posted_at(user_id, agent)
    txs = await supabase.list_transactions(user_id, agent=agent, limit=50)
    for tx in txs:
        if tx.get("status") != "confirmed":
            continue
        paid_at = _parse_iso_dt(str(tx.get("created_at") or ""))
        if not paid_at:
            continue
        if last_posted is None or paid_at > last_posted:
            return True
    return False


async def resolve_paid_agent_access(user_id: str, agent: str) -> dict:
    pending = await get_pending_paid_deliverable(user_id, agent)
    if pending:
        return {"status": "unlocked", "data": pending}
    if await has_unfulfilled_payment_since_last_post(user_id, agent):
        return {"status": "needs_load", "data": None}
    return {"status": "needs_payment", "data": None}


async def restore_paid_agent_deliverable(user_id: str, agent: str, body: dict) -> dict | list[dict]:
    """
    Return today's deliverable, or regenerate it when the user already paid today
    but content was not saved (e.g. navigation before persistence shipped).
    """
    if not supabase.enabled:
        raise SupabaseError("Supabase is required for agent deliverables")

    existing = await get_today_paid_deliverable(user_id, agent)
    if existing:
        return existing

    if not await has_unfulfilled_payment_since_last_post(user_id, agent):
        raise SupabaseError("No confirmed payment for this agent")

    if agent == "articles":
        result = await run_articles_agent(ArticlesRequest.model_validate(body))
        if isinstance(result, dict) and "error" in result:
            raise RuntimeError(result["error"])
        if not isinstance(result, ArticlesResponse):
            raise RuntimeError("Articles agent failed")
        payload = result.model_dump()
        saved = await save_paid_agent_deliverable(user_id, agent, payload)
        return saved if isinstance(saved, dict) else payload

    if agent == "linkedin":
        result = await run_linkedin_agent(LinkedInRequest.model_validate(body))
        if isinstance(result, dict) and "error" in result:
            raise RuntimeError(result["error"])
        if not isinstance(result, LinkedInResponse):
            raise RuntimeError("LinkedIn agent failed")
        payload = result.model_dump()
        saved = await save_paid_agent_deliverable(user_id, agent, payload)
        return saved if isinstance(saved, dict) else payload

    if agent == "hackernews":
        result = await run_hackernews_agent(HackerNewsRequest.model_validate(body))
        if isinstance(result, dict) and "error" in result:
            raise RuntimeError(result["error"])
        if not isinstance(result, HackerNewsResponse):
            raise RuntimeError("Hacker News agent failed")
        posts = [p.model_dump() for p in result.posts]
        saved = await save_paid_agent_deliverable(user_id, agent, posts)
        return saved if isinstance(saved, list) else posts

    raise SupabaseError(f"Restore not supported for agent: {agent}")


async def save_paid_agent_deliverable(
    user_id: str,
    agent: str,
    content: dict | list[dict],
) -> dict | list[dict]:
    if not supabase.enabled:
        raise SupabaseError("Supabase is required for agent deliverables")
    if agent not in PAID_AGENT_DAILY_LIMIT:
        raise SupabaseError(f"Unsupported paid agent: {agent}")

    existing = await get_today_paid_deliverable(user_id, agent)
    if existing:
        return existing

    today = _utc_today()
    payloads = content if isinstance(content, list) else [content]
    owes_new_slot = await has_unfulfilled_payment_since_last_post(user_id, agent)
    inserted: list[dict] = []
    for slot_index, item in enumerate(payloads[: PAID_AGENT_DAILY_LIMIT[agent]]):
        body = {k: v for k, v in item.items() if k != "id"}
        existing_row = await _get_today_slot_deliverable(user_id, agent, slot_index)
        if existing_row:
            if existing_row.get("status") == "pending":
                inserted.append(_format_saved_item(existing_row))
                continue
            if owes_new_slot:
                row = await supabase.update_agent_deliverable(
                    existing_row["id"],
                    {
                        "content": body,
                        "status": "pending",
                        "posted_at": None,
                    },
                )
                inserted.append(_format_saved_item(row))
                continue
            inserted.append(_format_saved_item(existing_row))
            continue

        try:
            row = await supabase.insert_agent_deliverable(
                {
                    "user_id": user_id,
                    "agent": agent,
                    "slot_index": slot_index,
                    "content": body,
                    "status": "pending",
                    "deliverable_date": today,
                }
            )
        except SupabaseError as exc:
            if not _is_unique_violation(exc):
                raise
            raced = await _get_today_slot_deliverable(user_id, agent, slot_index)
            if not raced:
                raise
            inserted.append(_format_saved_item(raced))
            continue
        inserted.append(_format_saved_item(row))

    if agent in ("articles", "linkedin"):
        return inserted[0] if inserted else {}
    return inserted


async def persist_paid_agent_result(user_id: str, agent: str, result: object) -> None:
    """Save agent output right after a paid run (server-side, survives navigation)."""
    if agent not in PAID_AGENT_DAILY_LIMIT:
        return
    try:
        if agent == "articles" and isinstance(result, ArticlesResponse):
            await save_paid_agent_deliverable(user_id, agent, result.model_dump())
        elif agent == "linkedin" and isinstance(result, LinkedInResponse):
            await save_paid_agent_deliverable(user_id, agent, result.model_dump())
        elif agent == "hackernews" and isinstance(result, HackerNewsResponse):
            posts = [p.model_dump() for p in result.posts]
            await save_paid_agent_deliverable(user_id, agent, posts)
    except Exception as exc:
        logger.warning("Failed to persist %s deliverable for %s: %s", agent, user_id[:8], exc)


async def mark_deliverable_posted(user_id: str, deliverable_id: str) -> dict:
    if not supabase.enabled:
        raise SupabaseError("Supabase is required for agent deliverables")

    row = await supabase.get_agent_deliverable(deliverable_id)
    if not row or row.get("user_id") != user_id:
        raise SupabaseError("Deliverable not found for user")

    updated = await supabase.update_agent_deliverable(
        deliverable_id,
        {
            "status": "posted",
            "posted_at": datetime.now(UTC).isoformat(),
        },
    )
    return _deliverable_to_tweet(updated)
