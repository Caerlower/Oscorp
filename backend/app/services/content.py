from __future__ import annotations

import json
import re

from openai import AsyncOpenAI

from app.config.settings import settings


def _groq_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.groq_base_url,
    )


def _parse_draft_json(raw: str) -> tuple[str, str]:
    text = raw.strip()
    try:
        parsed = json.loads(text)
        return str(parsed.get("content", ""))[:280], str(parsed.get("reasoning", ""))
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return str(parsed.get("content", ""))[:280], str(parsed.get("reasoning", ""))
            except json.JSONDecodeError:
                pass
    return text[:280], "Groq returned plain text (JSON parse fallback)."


async def generate_post_copy(
    *,
    niche: str,
    goal: str,
    tone: str,
    topic: str,
    hooks: list[str] | None = None,
    thread_outline: str | None = None,
    x_research: dict | None = None,
    telegram_summary: str = "",
    telegram_feedback: list[str] | None = None,
    previous_drafts: list[str] | None = None,
    cycle_index: int = 0,
) -> tuple[str, str]:
    if not settings.groq_api_key:
        content = (
            f"Hot take for {niche}: {topic}. "
            f"If you're building in this space, focus on distribution before polish. "
            f"Goal: {goal}"
        )[:280]
        return content, "Deterministic fallback copy (no GROQ_API_KEY)."

    signals = (x_research or {}).get("x_signals", "")
    angles = (x_research or {}).get("suggested_angles", [])
    prior = previous_drafts or []
    prior_block = "\n".join(f"- {p}" for p in prior[:5]) if prior else "(none)"
    prompt = (
        f"Write one X post (max 280 chars). Cycle #{cycle_index + 1}.\n"
        f"Niche: {niche}\nGoal: {goal}\nTone: {tone}\nTopic: {topic}\n"
        f"Hooks to weave in (pick ONE primary hook, do not copy all verbatim):\n"
        f"{hooks or []}\n"
        f"Thread context: {thread_outline or 'n/a'}\n"
        f"Live X research: {signals}\nSuggested angles: {angles}\n"
        f"Telegram memory: {telegram_summary or 'n/a'}\n"
        f"User feedback notes: {telegram_feedback or []}\n"
        f"Previous drafts — MUST differ in opening line, structure, and CTA:\n{prior_block}\n"
        "Do not repeat phrasing from previous drafts. Use a fresh angle.\n"
        "Respond with JSON only: {\"content\": \"...\", \"reasoning\": \"...\"}"
    )

    client = _groq_client()
    response = await client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": "You are Oscorp, an X growth operator. Output valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.9 if prior else 0.75,
        max_tokens=512,
    )
    raw = response.choices[0].message.content or "{}"
    return _parse_draft_json(raw)
