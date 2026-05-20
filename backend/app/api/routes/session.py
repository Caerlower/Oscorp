from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.algorand import (
    ensure_agent_usdc_ready,
    generate_agent_wallet,
    get_agent_balances,
    can_run_growth_cycle,
    is_agent_funded,
)
from app.services.wallet_address import normalize_wallet_address
from app.store.memory import store

router = APIRouter(prefix="/api/session", tags=["session"])


class ConnectWalletRequest(BaseModel):
    wallet_address: str = Field(..., min_length=10)


class ConnectWalletResponse(BaseModel):
    user_id: str
    wallet_address: str
    agent_address: str
    policy_signed: bool
    agent_funded: bool
    usdc_micro: int
    usdc_opted_in: bool
    algo_micro: int
    min_fund_micro_usdc: int


class SignPolicyRequest(BaseModel):
    user_id: str
    policy: dict
    signature: str = Field(..., min_length=8)


class LinkTelegramRequest(BaseModel):
    user_id: str
    chat_id: int


class TelegramContextRequest(BaseModel):
    user_id: str
    summary: str | None = None
    feedback_note: str | None = None
    preferences: dict | None = None
    chat_id: int | None = None


class AgentStatusResponse(BaseModel):
    user_id: str
    wallet_address: str
    agent_address: str
    policy_signed: bool
    policy: dict | None
    agent_funded: bool
    usdc_micro: int
    algo_micro: int = 0
    usdc_opted_in: bool
    spend_cap_micro_usdc: int
    min_fund_micro_usdc: int
    telegram_linked: bool


@router.post("/connect", response_model=ConnectWalletResponse)
async def connect_wallet(req: ConnectWalletRequest) -> ConnectWalletResponse:
    try:
        address = normalize_wallet_address(req.wallet_address)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Algorand wallet address") from exc
    existing = store.get_user_by_wallet(address)
    if not existing:
        agent_address, agent_mnemonic = generate_agent_wallet()
        existing = store.upsert_wallet_user(
            wallet_address=address,
            agent_address=agent_address,
            agent_mnemonic=agent_mnemonic,
        )
    balances = get_agent_balances(existing.agent_address)
    if not balances["usdc_opted_in"]:
        try:
            ensure_agent_usdc_ready(existing.agent_address, existing.agent_mnemonic)
            balances = get_agent_balances(existing.agent_address)
        except ValueError:
            pass  # needs ALGO on agent; fund page / dev faucet
    min_fund = existing.spend_cap_micro_usdc
    return ConnectWalletResponse(
        user_id=existing.id,
        wallet_address=existing.wallet_address,
        agent_address=existing.agent_address,
        policy_signed=existing.policy is not None,
        agent_funded=can_run_growth_cycle(balances),
        usdc_micro=int(balances["usdc_micro"]),
        usdc_opted_in=bool(balances["usdc_opted_in"]),
        algo_micro=int(balances["algo_micro"]),
        min_fund_micro_usdc=min_fund,
    )


@router.get("/{user_id}", response_model=AgentStatusResponse)
async def get_session(user_id: str) -> AgentStatusResponse:
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    balances = get_agent_balances(user.agent_address)
    min_fund = user.spend_cap_micro_usdc
    return AgentStatusResponse(
        user_id=user.id,
        wallet_address=user.wallet_address,
        agent_address=user.agent_address,
        policy_signed=user.policy is not None,
        policy=user.policy,
        agent_funded=can_run_growth_cycle(balances),
        usdc_micro=int(balances["usdc_micro"]),
        algo_micro=int(balances["algo_micro"]),
        usdc_opted_in=bool(balances["usdc_opted_in"]),
        spend_cap_micro_usdc=user.spend_cap_micro_usdc,
        min_fund_micro_usdc=min_fund,
        telegram_linked=user.telegram_chat_id is not None,
    )


@router.post("/link-telegram", response_model=AgentStatusResponse)
async def link_telegram(req: LinkTelegramRequest) -> AgentStatusResponse:
    user = store.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    store.link_telegram(req.user_id, req.chat_id)
    return await get_session(req.user_id)


@router.post("/telegram-context")
async def sync_telegram_context(req: TelegramContextRequest) -> dict:
    """Telegram / client syncs conversation learnings before run-cycle."""
    user = store.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.summary:
        store.update_telegram_summary(req.user_id, req.summary)
    if req.feedback_note:
        store.add_telegram_feedback(req.user_id, req.feedback_note)
    if req.preferences:
        store.merge_telegram_preferences(req.user_id, req.preferences)
    if req.chat_id is not None:
        store.link_telegram(req.user_id, req.chat_id)
    mem = user.telegram_memory
    return {
        "ok": True,
        "summary": mem.summary,
        "preferences": mem.preferences,
        "feedback_notes": mem.feedback_notes[-8:],
        "telegram_linked": user.telegram_chat_id is not None,
    }


@router.get("/{user_id}/telegram-memory")
async def get_telegram_memory(user_id: str) -> dict:
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    mem = user.telegram_memory
    return {
        "summary": mem.summary,
        "preferences": mem.preferences,
        "feedback_notes": mem.feedback_notes,
        "message_count": len(mem.messages),
        "recent_messages": mem.messages[-6:],
    }


@router.post("/policy", response_model=AgentStatusResponse)
async def sign_policy(req: SignPolicyRequest) -> AgentStatusResponse:
    user = store.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    store.save_policy(req.user_id, req.policy, req.signature)
    return await get_session(req.user_id)
