from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from app.config.settings import settings
from app.services.content import _groq_client
from app.services.growth_cycle import run_growth_cycle_for_user
from app.services.telegram_notify import send_cycle_briefing, send_draft_with_actions
from app.store.memory import UserRecord, store


@dataclass
class AgentReply:
    text: str
    ran_cycle: bool = False
    memory_updated: bool = False


def _parse_agent_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {"reply": raw[:2000], "memory_summary": "", "preference_updates": {}, "run_cycle": False}


async def chat_with_user(*, user: UserRecord, message: str) -> AgentReply:
    mem = user.telegram_memory
    store.append_telegram_message(user.id, role="user", content=message)

    policy = user.policy or {}
    recent = store.get_telegram_messages(user.id, limit=16)
    history = [{"role": m["role"], "content": m["content"]} for m in recent[:-1]]

    system = (
        "You are Oscorp, a conversational X growth operator on Telegram.\n"
        "Learn the user's niche, tone, goals, and feedback over time.\n"
        "You do NOT post to X automatically — drafts go through human approval.\n\n"
        "Respond with JSON only:\n"
        "{\n"
        '  "reply": "friendly message to user",\n'
        '  "memory_summary": "2-4 sentence rolling summary of what user wants",\n'
        '  "preference_updates": {"niche":"", "tone":"", "growth_goal":"", "x_handle":"", "feedback_note": "optional single new note"},\n'
        '  "run_cycle": false\n'
        "}\n\n"
        "Set run_cycle true only when user clearly asks to run/generate a growth cycle now.\n"
        "Put durable preferences in preference_updates; use feedback_note for one-off critique.\n"
        f"Signed policy: {json.dumps(policy, default=str)[:1200]}\n"
        f"Current memory summary: {mem.summary or '(empty)'}\n"
        f"Stored feedback notes: {mem.feedback_notes[-5:]}\n"
        f"Preference overrides: {mem.preferences}\n"
    )

    if not settings.groq_api_key:
        store.append_telegram_message(
            user.id,
            role="assistant",
            content="Groq is not configured. Set GROQ_API_KEY in backend/.env.",
        )
        return AgentReply(
            text="I need GROQ_API_KEY configured on the server to chat. Policy and /run still work.",
            memory_updated=False,
        )

    client = _groq_client()
    response = await client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system},
            *history,
            {"role": "user", "content": message},
        ],
        temperature=0.6,
        max_tokens=1024,
    )
    raw = response.choices[0].message.content or "{}"
    parsed = _parse_agent_json(raw)
    reply_text = str(parsed.get("reply", "Got it."))[:3500]

    summary = parsed.get("memory_summary")
    if isinstance(summary, str) and summary.strip():
        store.update_telegram_summary(user.id, summary.strip())

    prefs = parsed.get("preference_updates") or {}
    if isinstance(prefs, dict) and prefs:
        note = prefs.pop("feedback_note", None)
        if note:
            store.add_telegram_feedback(user.id, str(note))
        clean = {k: v for k, v in prefs.items() if v}
        if clean:
            store.merge_telegram_preferences(user.id, clean)

    store.append_telegram_message(user.id, role="assistant", content=reply_text)

    if parsed.get("run_cycle") is True:
        cycle_reply = await _execute_cycle(user)
        return AgentReply(
            text=f"{reply_text}\n\n{cycle_reply}",
            ran_cycle=True,
            memory_updated=True,
        )

    return AgentReply(text=reply_text, memory_updated=bool(summary or prefs))


async def _execute_cycle(user: UserRecord) -> str:
    try:
        out = await run_growth_cycle_for_user(user)
    except ValueError as e:
        return f"Could not run cycle: {e}"

    record = out["record"]
    result = out["result"]
    payment_txs = out["payment_txs"]

    if user.telegram_chat_id:
        await send_cycle_briefing(
            chat_id=user.telegram_chat_id,
            trends=result.get("trends", {}),
            x_research=result.get("x_research", {}),
        )
        await send_draft_with_actions(
            chat_id=user.telegram_chat_id,
            draft_id=record.id,
            content=record.content,
            reasoning=record.reasoning,
            intent_url=record.intent_url,
            provider_outputs=record.provider_outputs,
            payment_txs=payment_txs,
            category=record.category,
        )

    return (
        "Growth cycle complete.\n"
        f"Draft: {record.content[:200]}{'…' if len(record.content) > 200 else ''}\n"
        f"Post on X: {record.intent_url}"
    )
