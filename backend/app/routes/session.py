from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.blockchain.algorand import (
    can_run_growth_cycle,
    ensure_agent_usdc_ready,
    generate_agent_wallet,
    get_agent_balances,
)
from app.payments.wallet_address import normalize_wallet_address
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
            pass
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
    )

