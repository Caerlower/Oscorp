from __future__ import annotations

import asyncio
import logging
import time
from datetime import UTC, datetime
from typing import Any

from openai import APIStatusError, AsyncOpenAI, RateLimitError

from app.config.settings import settings
from app.core.json_utils import parse_groq_json

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"
MIN_GAP_SECONDS = 1.0
RATE_LIMIT_BASE_WAIT = 5.0
MAX_RETRIES = 3

_client: AsyncOpenAI | None = None
_queue_lock = asyncio.Lock()
_last_call_finished_at: float = 0.0


def get_groq_client() -> AsyncOpenAI:
    """Return the single shared Groq client (OpenAI-compatible API)."""
    global _client
    if _client is None:
        if not settings.groq_api_key.strip():
            raise ValueError("GROQ_API_KEY is not configured")
        _client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            timeout=90.0,
        )
    return _client


async def _wait_for_gap() -> None:
    """Enforce a minimum 1 second gap between Groq calls."""
    global _last_call_finished_at
    if _last_call_finished_at <= 0:
        return
    elapsed = time.monotonic() - _last_call_finished_at
    if elapsed < MIN_GAP_SECONDS:
        await asyncio.sleep(MIN_GAP_SECONDS - elapsed)


def _is_rate_limit(exc: Exception) -> bool:
    if isinstance(exc, RateLimitError):
        return True
    return isinstance(exc, APIStatusError) and exc.status_code == 429


def is_groq_rate_limit(exc: Exception) -> bool:
    if _is_rate_limit(exc):
        return True
    msg = str(exc).lower()
    if "rate limit" in msg or "rate_limit" in msg or "429" in msg:
        return True
    status = getattr(exc, "status_code", None)
    return status == 429


async def groq_json_completion(
    *,
    agent_name: str,
    system: str,
    user: str,
    max_tokens: int = 4096,
    temperature: float = 0.4,
    strict: bool = False,
) -> dict[str, Any]:
    """
    Queued Groq JSON completion — all agents must use this entry point.

    - Serializes requests (no parallel Groq calls)
    - 1s minimum gap between calls
    - Retries on 429 with exponential backoff (5s, 10s, 20s)
    """
    timestamp = datetime.now(UTC).isoformat()

    user_content = user
    if strict:
        user_content = (
            f"{user}\n\n"
            "STRICT REMINDER: Respond with ONLY valid JSON matching the provided schema exactly. "
            "No markdown fences, no explanation, no commentary, no extra keys."
        )

    global _last_call_finished_at

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        await _wait_for_gap()
        async with _queue_lock:
            client = get_groq_client()
            try:
                completion = await client.chat.completions.create(
                    model=GROQ_MODEL,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_content},
                    ],
                )
                text = completion.choices[0].message.content or "{}"
                parsed = parse_groq_json(text)
                if not isinstance(parsed, dict):
                    raise ValueError("Groq response was not a JSON object")
                _last_call_finished_at = time.monotonic()
                logger.info(
                    "Groq call success agent=%s timestamp=%s attempt=%s",
                    agent_name,
                    timestamp,
                    attempt + 1,
                )
                return parsed
            except Exception as exc:
                last_error = exc
                _last_call_finished_at = time.monotonic()
                if _is_rate_limit(exc) and attempt < MAX_RETRIES:
                    wait = RATE_LIMIT_BASE_WAIT * (2**attempt)
                    logger.warning(
                        "Groq rate limit agent=%s timestamp=%s attempt=%s wait=%ss error=%s",
                        agent_name,
                        timestamp,
                        attempt + 1,
                        wait,
                        exc,
                    )
                else:
                    logger.error(
                        "Groq call failure agent=%s timestamp=%s attempt=%s error=%s",
                        agent_name,
                        timestamp,
                        attempt + 1,
                        exc,
                    )
                    raise

        if last_error and _is_rate_limit(last_error) and attempt < MAX_RETRIES:
            await asyncio.sleep(RATE_LIMIT_BASE_WAIT * (2**attempt))

    logger.error(
        "Groq call exhausted retries agent=%s timestamp=%s error=%s",
        agent_name,
        timestamp,
        last_error,
    )
    raise last_error or RuntimeError("Groq request failed")


async def groq_chat_completion(
    *,
    agent_name: str,
    system: str,
    messages: list[dict[str, str]],
    max_tokens: int = 2048,
    temperature: float = 0.45,
) -> str:
    """Queued Groq chat completion — plain text, multi-turn."""
    timestamp = datetime.now(UTC).isoformat()
    global _last_call_finished_at

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        await _wait_for_gap()
        async with _queue_lock:
            client = get_groq_client()
            try:
                completion = await client.chat.completions.create(
                    model=GROQ_MODEL,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=[{"role": "system", "content": system}, *messages],
                )
                text = (completion.choices[0].message.content or "").strip()
                if not text:
                    raise ValueError("Groq returned an empty response")
                _last_call_finished_at = time.monotonic()
                logger.info(
                    "Groq chat success agent=%s timestamp=%s attempt=%s",
                    agent_name,
                    timestamp,
                    attempt + 1,
                )
                return text
            except Exception as exc:
                last_error = exc
                _last_call_finished_at = time.monotonic()
                if _is_rate_limit(exc) and attempt < MAX_RETRIES:
                    wait = RATE_LIMIT_BASE_WAIT * (2**attempt)
                    logger.warning(
                        "Groq chat rate limit agent=%s timestamp=%s attempt=%s wait=%ss error=%s",
                        agent_name,
                        timestamp,
                        attempt + 1,
                        wait,
                        exc,
                    )
                else:
                    logger.error(
                        "Groq chat failure agent=%s timestamp=%s attempt=%s error=%s",
                        agent_name,
                        timestamp,
                        attempt + 1,
                        exc,
                    )
                    raise

        if last_error and _is_rate_limit(last_error) and attempt < MAX_RETRIES:
            await asyncio.sleep(RATE_LIMIT_BASE_WAIT * (2**attempt))

    logger.error(
        "Groq chat exhausted retries agent=%s timestamp=%s error=%s",
        agent_name,
        timestamp,
        last_error,
    )
    raise last_error or RuntimeError("Groq chat request failed")
