from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class TelegramMemory:
    """Per-user conversational context from Telegram (survives until server restart)."""

    summary: str = ""
    feedback_notes: list[str] = field(default_factory=list)
    preferences: dict[str, Any] = field(default_factory=dict)
    messages: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class UserRecord:
    id: str
    wallet_address: str
    agent_address: str
    agent_mnemonic: str
    created_at: datetime = field(default_factory=_utcnow)
    policy: dict[str, Any] | None = None
    policy_signature: str | None = None
    policy_signed_at: datetime | None = None
    spend_cap_micro_usdc: int = 500_000
    telegram_chat_id: int | None = None
    telegram_memory: TelegramMemory = field(default_factory=TelegramMemory)


@dataclass
class DraftRecord:
    id: str
    user_id: str
    content: str
    reasoning: str
    intent_url: str
    category: str
    provider_outputs: dict[str, Any]
    payment_txs: list[str]
    created_at: datetime = field(default_factory=_utcnow)


class MemoryStore:
    def __init__(self) -> None:
        self.users_by_wallet: dict[str, UserRecord] = {}
        self.users_by_id: dict[str, UserRecord] = {}
        self.users_by_chat: dict[int, UserRecord] = {}
        self.drafts_by_user: dict[str, list[DraftRecord]] = {}

    def _persist(self) -> None:
        from app.store.persist import save_store

        save_store(self)

    def get_user_by_wallet(self, address: str) -> UserRecord | None:
        return self.users_by_wallet.get(address)

    def get_user(self, user_id: str) -> UserRecord | None:
        return self.users_by_id.get(user_id)

    def upsert_wallet_user(
        self,
        *,
        wallet_address: str,
        agent_address: str,
        agent_mnemonic: str,
    ) -> UserRecord:
        existing = self.users_by_wallet.get(wallet_address)
        if existing:
            return existing
        user = UserRecord(
            id=str(uuid.uuid4()),
            wallet_address=wallet_address,
            agent_address=agent_address,
            agent_mnemonic=agent_mnemonic,
        )
        self.users_by_wallet[wallet_address] = user
        self.users_by_id[user.id] = user
        self.drafts_by_user[user.id] = []
        self._persist()
        return user

    def save_policy(
        self,
        user_id: str,
        policy: dict[str, Any],
        signature: str,
    ) -> UserRecord:
        user = self.users_by_id[user_id]
        user.policy = policy
        user.policy_signature = signature
        user.policy_signed_at = _utcnow()
        user.spend_cap_micro_usdc = int(
            policy.get("spend_cap_micro_usdc", user.spend_cap_micro_usdc)
        )
        self._persist()
        return user

    def add_draft(
        self,
        *,
        user_id: str,
        content: str,
        reasoning: str,
        intent_url: str,
        category: str,
        provider_outputs: dict[str, Any],
        payment_txs: list[str],
    ) -> DraftRecord:
        draft = DraftRecord(
            id=str(uuid.uuid4()),
            user_id=user_id,
            content=content,
            reasoning=reasoning,
            intent_url=intent_url,
            category=category,
            provider_outputs=provider_outputs,
            payment_txs=payment_txs,
        )
        self.drafts_by_user.setdefault(user_id, []).insert(0, draft)
        self._persist()
        return draft

    def list_drafts(self, user_id: str) -> list[DraftRecord]:
        return self.drafts_by_user.get(user_id, [])

    def get_draft(self, user_id: str, draft_id: str) -> DraftRecord | None:
        for draft in self.drafts_by_user.get(user_id, []):
            if draft.id == draft_id:
                return draft
        return None

    def link_telegram(self, user_id: str, chat_id: int) -> UserRecord:
        user = self.users_by_id[user_id]
        if user.telegram_chat_id:
            self.users_by_chat.pop(user.telegram_chat_id, None)
        user.telegram_chat_id = chat_id
        self.users_by_chat[chat_id] = user
        self._persist()
        return user

    def get_user_by_chat_id(self, chat_id: int) -> UserRecord | None:
        return self.users_by_chat.get(chat_id)

    _MAX_TELEGRAM_MESSAGES = 48

    def append_telegram_message(self, user_id: str, *, role: str, content: str) -> None:
        user = self.users_by_id[user_id]
        mem = user.telegram_memory
        mem.messages.append(
            {
                "role": role,
                "content": content[:4000],
                "at": _utcnow().isoformat(),
            }
        )
        if len(mem.messages) > self._MAX_TELEGRAM_MESSAGES:
            mem.messages = mem.messages[-self._MAX_TELEGRAM_MESSAGES :]

    def get_telegram_messages(self, user_id: str, *, limit: int = 20) -> list[dict[str, Any]]:
        user = self.users_by_id[user_id]
        return user.telegram_memory.messages[-limit:]

    def update_telegram_summary(self, user_id: str, summary: str) -> None:
        self.users_by_id[user_id].telegram_memory.summary = summary[:2000]

    def add_telegram_feedback(self, user_id: str, note: str) -> None:
        mem = self.users_by_id[user_id].telegram_memory
        mem.feedback_notes.append(note[:500])
        if len(mem.feedback_notes) > 32:
            mem.feedback_notes = mem.feedback_notes[-32:]

    def merge_telegram_preferences(self, user_id: str, updates: dict[str, Any]) -> None:
        mem = self.users_by_id[user_id].telegram_memory
        for key, value in updates.items():
            if value is not None and value != "":
                mem.preferences[key] = value

    def clear_telegram_memory(self, user_id: str) -> None:
        self.users_by_id[user_id].telegram_memory = TelegramMemory()

    @staticmethod
    def policy_message(policy: dict[str, Any]) -> bytes:
        canonical = json.dumps(policy, sort_keys=True, separators=(",", ":"))
        return f"Oscorp Policy v1\n{canonical}".encode()


store = MemoryStore()

try:
    from app.store.persist import load_store

    _loaded = load_store(store)
    if _loaded:
        import logging

        logging.getLogger(__name__).info("Loaded %s Oscorp user(s) from disk", _loaded)
except Exception:
    import logging

    logging.getLogger(__name__).exception("Failed to load Oscorp store from disk")
