from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class TelegramMemory:
    """Legacy persisted field — no longer used at runtime."""

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
