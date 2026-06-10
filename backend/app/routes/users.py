from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config.settings import settings
from app.blockchain.algorand import get_agent_balances
from app.db.supabase_client import SupabaseError, supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


class UserRecord(BaseModel):
    id: str
    wallet_address: str
    payment_mode: str = "per_action"
    agent_wallet_address: str | None = None
    agent_wallet_usdc_balance: float = 0
    batch_budget_usdc: float = 0
    batch_spent_usdc: float = 0
    onboarding_completed: bool = False
    product_site: str | None = None
    created_at: str | None = None


class UserUpdateRequest(BaseModel):
    payment_mode: str | None = Field(default=None, pattern="^(per_action|agent_wallet|batch)$")
    agent_wallet_address: str | None = None
    agent_wallet_usdc_balance: float | None = Field(default=None, ge=0)
    batch_budget_usdc: float | None = Field(default=None, ge=0)
    batch_spent_usdc: float | None = Field(default=None, ge=0)
    onboarding_completed: bool | None = None
    product_site: str | None = None


class TransactionRecord(BaseModel):
    id: str
    user_id: str
    agent: str
    amount_usdc: float
    tx_hash: str
    status: str
    payment_mode: str
    from_address: str | None = None
    to_address: str | None = None
    agent_wallet_address: str | None = None
    created_at: str | None = None


_local_users: dict[str, dict[str, Any]] = {}


def _local_users_path() -> Path:
    root = Path(settings.data_dir).expanduser()
    root.mkdir(parents=True, exist_ok=True)
    return root / "local_payment_users.json"


def _load_local_users() -> None:
    path = _local_users_path()
    if not path.exists():
        return
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            _local_users.update(raw)
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Could not load local payment users: %s", exc)


def _save_local_users() -> None:
    try:
        _local_users_path().write_text(
            json.dumps(_local_users, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("Could not save local payment users: %s", exc)


def _local_user_id(wallet_address: str) -> str:
    return f"local-{wallet_address[:12]}"


def _local_user_fallback(wallet_address: str) -> dict[str, Any]:
    uid = _local_user_id(wallet_address)
    if uid not in _local_users:
        _local_users[uid] = {
            "id": uid,
            "wallet_address": wallet_address,
            "payment_mode": "per_action",
            "agent_wallet_address": None,
            "agent_wallet_usdc_balance": 0,
            "batch_budget_usdc": 0,
            "batch_spent_usdc": 0,
            "onboarding_completed": False,
            "product_site": None,
            "created_at": None,
        }
        _save_local_users()
    return _local_users[uid]


_load_local_users()


@router.get("/by-wallet/{wallet_address}", response_model=UserRecord)
async def get_user_by_wallet(wallet_address: str) -> Any:
    if not supabase.enabled:
        return _local_user_fallback(wallet_address)
    try:
        user = await supabase.get_user_by_wallet(wallet_address)
        if not user:
            user = await supabase.upsert_user(wallet_address)
        return user
    except SupabaseError as exc:
        logger.warning("Supabase unavailable for %s: %s — using local fallback", wallet_address[:8], exc)
        return _local_user_fallback(wallet_address)


@router.patch("/{user_id}", response_model=UserRecord)
async def update_user(user_id: str, body: UserUpdateRequest) -> Any:
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")

    if patch.get("payment_mode") == "batch":
        patch["payment_mode"] = "agent_wallet"

    def _apply_local_patch(record: dict[str, Any]) -> dict[str, Any]:
        record.update(patch)
        _local_users[record["id"]] = record
        _save_local_users()
        return record

    if not supabase.enabled:
        record = _local_users.get(user_id)
        if not record:
            raise HTTPException(status_code=404, detail="User not found")
        return _apply_local_patch(record)
    try:
        return await supabase.update_user(user_id, patch)
    except SupabaseError as exc:
        logger.warning("Supabase update failed for %s: %s", user_id, exc)
        record = _local_users.get(user_id)
        if record:
            return _apply_local_patch(record)
        try:
            existing = await supabase.get_user_by_id(user_id)
            if existing:
                # Return merged profile so onboarding can continue before migration is applied.
                return {**existing, **patch}
        except SupabaseError:
            pass
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{user_id}/transactions", response_model=list[TransactionRecord])
async def list_user_transactions(
    user_id: str,
    agent: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Any:
    if not supabase.enabled:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        return await supabase.list_transactions(user_id, agent=agent, limit=limit, offset=offset)
    except SupabaseError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{wallet_address}/balances")
async def wallet_balances(wallet_address: str) -> dict[str, Any]:
    try:
        balances = get_agent_balances(wallet_address)
        return {
            "wallet_address": wallet_address,
            "algo_micro": balances["algo_micro"],
            "usdc_micro": balances["usdc_micro"],
            "usdc_opted_in": balances["usdc_opted_in"],
            "algo": balances["algo_micro"] / 1_000_000,
            "usdc": balances["usdc_micro"] / 1_000_000,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
