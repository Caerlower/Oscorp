from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config.settings import settings
from app.store.memory import DraftRecord, MemoryStore, TelegramMemory, UserRecord


def _data_path() -> Path:
    root = Path(settings.data_dir).expanduser()
    root.mkdir(parents=True, exist_ok=True)
    return root / "oscorp_store.json"


def _dt_to_str(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _str_to_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def _user_to_dict(user: UserRecord) -> dict[str, Any]:
    mem = user.telegram_memory
    return {
        "id": user.id,
        "wallet_address": user.wallet_address,
        "agent_address": user.agent_address,
        "agent_mnemonic": user.agent_mnemonic,
        "created_at": _dt_to_str(user.created_at),
        "policy": user.policy,
        "policy_signature": user.policy_signature,
        "policy_signed_at": _dt_to_str(user.policy_signed_at),
        "spend_cap_micro_usdc": user.spend_cap_micro_usdc,
        "telegram_chat_id": user.telegram_chat_id,
        "telegram_memory": {
            "summary": mem.summary,
            "feedback_notes": mem.feedback_notes,
            "preferences": mem.preferences,
            "messages": mem.messages,
        },
    }


def _user_from_dict(data: dict[str, Any]) -> UserRecord:
    mem_raw = data.get("telegram_memory") or {}
    mem = TelegramMemory(
        summary=str(mem_raw.get("summary", "")),
        feedback_notes=list(mem_raw.get("feedback_notes", [])),
        preferences=dict(mem_raw.get("preferences", {})),
        messages=list(mem_raw.get("messages", [])),
    )
    created = _str_to_dt(data.get("created_at")) or datetime.now().astimezone()
    return UserRecord(
        id=str(data["id"]),
        wallet_address=str(data["wallet_address"]),
        agent_address=str(data["agent_address"]),
        agent_mnemonic=str(data["agent_mnemonic"]),
        created_at=created,
        policy=data.get("policy"),
        policy_signature=data.get("policy_signature"),
        policy_signed_at=_str_to_dt(data.get("policy_signed_at")),
        spend_cap_micro_usdc=int(data.get("spend_cap_micro_usdc", 500_000)),
        telegram_chat_id=data.get("telegram_chat_id"),
        telegram_memory=mem,
    )


def _draft_to_dict(draft: DraftRecord) -> dict[str, Any]:
    return {
        "id": draft.id,
        "user_id": draft.user_id,
        "content": draft.content,
        "reasoning": draft.reasoning,
        "intent_url": draft.intent_url,
        "category": draft.category,
        "provider_outputs": draft.provider_outputs,
        "payment_txs": draft.payment_txs,
        "created_at": _dt_to_str(draft.created_at),
    }


def _draft_from_dict(data: dict[str, Any]) -> DraftRecord:
    created = _str_to_dt(data.get("created_at")) or datetime.now().astimezone()
    return DraftRecord(
        id=str(data["id"]),
        user_id=str(data["user_id"]),
        content=str(data["content"]),
        reasoning=str(data["reasoning"]),
        intent_url=str(data["intent_url"]),
        category=str(data["category"]),
        provider_outputs=dict(data.get("provider_outputs", {})),
        payment_txs=list(data.get("payment_txs", [])),
        created_at=created,
    )


def save_store(store: MemoryStore) -> None:
    path = _data_path()
    payload = {
        "users": [_user_to_dict(u) for u in store.users_by_id.values()],
        "drafts": {
            uid: [_draft_to_dict(d) for d in drafts]
            for uid, drafts in store.drafts_by_user.items()
        },
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_store(store: MemoryStore) -> int:
    path = _data_path()
    if not path.exists():
        return 0
    raw = json.loads(path.read_text(encoding="utf-8"))
    users = [_user_from_dict(u) for u in raw.get("users", [])]
    store.users_by_wallet.clear()
    store.users_by_id.clear()
    store.drafts_by_user.clear()
    for user in users:
        store.users_by_wallet[user.wallet_address] = user
        store.users_by_id[user.id] = user
        store.drafts_by_user[user.id] = []
    for uid, draft_list in (raw.get("drafts") or {}).items():
        if uid in store.drafts_by_user:
            store.drafts_by_user[uid] = [_draft_from_dict(d) for d in draft_list]
    return len(users)
