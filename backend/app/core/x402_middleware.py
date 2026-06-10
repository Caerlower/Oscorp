from __future__ import annotations

import base64
import json
import logging
from typing import Annotated, Any

import httpx
from fastapi import Header, HTTPException, Request

from app.config.settings import settings
from app.core.payment_constants import (
    AGENT_PRICES,
    FACILITATOR_FEE_PAYER,
    RECIPIENT_ADDRESS,
    usdc_to_micro,
)
from app.db.supabase_client import SupabaseError, supabase
from app.payments.wallet_address import normalize_address

logger = logging.getLogger(__name__)

# Hardcoded treasury — must match payment_constants.RECIPIENT_ADDRESS.
OSCORP_WALLET = RECIPIENT_ADDRESS
FACILITATOR_URL = settings.facilitator_url.rstrip("/")
ALGORAND_TESTNET_CAIP2 = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
USDC_TESTNET_ASA_ID = settings.usdc_asset_id

_used_tx_hashes: set[str] = set()


def _encode_header_value(payload: dict[str, Any]) -> str:
    return base64.b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("ascii")


def _decode_payment_header(header: str) -> dict[str, Any]:
    raw = header.strip()
    try:
        decoded = base64.b64decode(raw, validate=True)
        payload = json.loads(decoded.decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=402, detail={"error": "Invalid payment header"}) from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=402, detail={"error": "Invalid payment header"})
    return payload


def build_payment_requirements(agent: str) -> dict[str, Any]:
    price = AGENT_PRICES[agent]
    return {
        "scheme": "exact",
        "network": ALGORAND_TESTNET_CAIP2,
        "asset": str(USDC_TESTNET_ASA_ID),
        "amount": str(usdc_to_micro(price)),
        "payTo": OSCORP_WALLET,
        "maxTimeoutSeconds": 60,
        "extra": {
            "name": "USDC",
            "decimals": 6,
            # Facilitator co-signs fee payer txn so clients only need USDC, not ALGO.
            "feePayer": FACILITATOR_FEE_PAYER,
        },
    }


def build_payment_required(agent: str, request: Request) -> dict[str, Any]:
    price = AGENT_PRICES[agent]
    requirements = build_payment_requirements(agent)
    return {
        "x402Version": 2,
        "error": "Payment required",
        "resource": {
            "url": str(request.url),
            "description": f"Oscorp {agent} agent — ${price:.2f} USDC",
        },
        "accepts": [requirements],
    }


def payment_required_exception(agent: str, request: Request) -> HTTPException:
    payment_required = build_payment_required(agent, request)
    encoded = _encode_header_value(payment_required)
    return HTTPException(
        status_code=402,
        detail={"paymentRequired": payment_required},
        headers={
            "PAYMENT-REQUIRED": encoded,
            "X-PAYMENT-REQUIREMENTS": json.dumps(build_payment_requirements(agent)),
        },
    )


def _extract_payment_header(request: Request) -> str | None:
    for name in ("payment-signature", "PAYMENT-SIGNATURE", "x-payment", "X-PAYMENT"):
        value = request.headers.get(name)
        if value and value.strip():
            return value.strip()
    return None


def _payment_mode_for_storage(mode: str) -> str:
    """Map x402 runtime modes to values allowed by transactions.payment_mode check."""
    if mode == "x402_batch":
        return "agent_wallet"
    if mode == "x402_per_action":
        return "per_action"
    return mode


def _resolve_payment_mode(user: dict[str, Any] | None, payer: str | None) -> str:
    if not user or not payer:
        return "x402_per_action"
    mode_pref = user.get("payment_mode") or "per_action"
    agent_addr = user.get("agent_wallet_address")
    main_addr = user.get("wallet_address")
    payer_norm = normalize_address(str(payer))
    if mode_pref in ("agent_wallet", "batch") and agent_addr and payer_norm == normalize_address(str(agent_addr)):
        return "x402_batch"
    if main_addr and payer_norm == normalize_address(str(main_addr)):
        return "x402_per_action"
    return "x402_per_action"


async def _verify_and_settle(payment_payload: dict[str, Any]) -> dict[str, Any]:
    requirements = payment_payload.get("accepted")
    if not isinstance(requirements, dict):
        raise HTTPException(status_code=402, detail={"error": "Payment verification failed"})

    body = {
        "x402Version": payment_payload.get("x402Version", 2),
        "paymentPayload": payment_payload,
        "paymentRequirements": requirements,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            verify_res = await client.post(f"{FACILITATOR_URL}/verify", json=body)
            verify_data = verify_res.json()
        except httpx.HTTPError as exc:
            logger.warning("Facilitator verify request failed: %s", exc)
            raise HTTPException(status_code=402, detail={"error": "Payment verification failed"}) from exc

        if not isinstance(verify_data, dict) or not verify_data.get("isValid"):
            reason = verify_data.get("invalidReason") if isinstance(verify_data, dict) else None
            logger.warning(
                "Facilitator rejected payment: isValid=%s invalidReason=%s response=%s",
                verify_data.get("isValid") if isinstance(verify_data, dict) else None,
                reason,
                verify_data,
            )
            raise HTTPException(
                status_code=402,
                detail={"error": "Payment verification failed", "reason": reason},
                headers={"X-PAYMENT-INVALID": "true"},
            )

        try:
            settle_res = await client.post(f"{FACILITATOR_URL}/settle", json=body)
            settle_data = settle_res.json()
        except httpx.HTTPError as exc:
            logger.warning("Facilitator settle request failed: %s", exc)
            raise HTTPException(status_code=402, detail={"error": "Payment settlement failed"}) from exc

        if not isinstance(settle_data, dict) or not settle_data.get("success"):
            error_message = settle_data.get("errorMessage") if isinstance(settle_data, dict) else None
            logger.warning(
                "Facilitator settlement failed: success=%s errorMessage=%s response=%s",
                settle_data.get("success") if isinstance(settle_data, dict) else None,
                error_message,
                settle_data,
            )
            raise HTTPException(
                status_code=402,
                detail={"error": "Payment settlement failed", "reason": error_message},
                headers={"X-PAYMENT-INVALID": "true"},
            )

    return {**verify_data, **settle_data}


async def _record_transaction(
    *,
    agent: str,
    user_id: str | None,
    user_record: dict[str, Any] | None,
    settlement: dict[str, Any],
    payment_mode: str,
) -> None:
    tx_hash = str(settlement.get("transaction") or "")
    if not tx_hash:
        return

    payer = settlement.get("payer")
    amount_usdc = AGENT_PRICES.get(agent, 0.0)

    if supabase.enabled and user_id:
        try:
            if await supabase.tx_hash_used(tx_hash):
                raise HTTPException(status_code=402, detail={"error": "Payment already used"})
            tx_row: dict[str, Any] = {
                "user_id": user_id,
                "agent": agent,
                "amount_usdc": amount_usdc,
                "tx_hash": tx_hash,
                "status": "confirmed",
                "payment_mode": _payment_mode_for_storage(payment_mode),
                "from_address": payer,
                "to_address": OSCORP_WALLET,
            }
            if payment_mode == "x402_batch" and user_record:
                tx_row["agent_wallet_address"] = user_record.get("agent_wallet_address")
            await supabase.insert_transaction(tx_row)

            if payment_mode == "x402_batch" and user_record:
                agent_addr = user_record.get("agent_wallet_address")
                if agent_addr:
                    try:
                        from app.blockchain.algorand import get_agent_balances

                        balances = get_agent_balances(str(agent_addr))
                        await supabase.update_user(
                            user_id,
                            {"agent_wallet_usdc_balance": balances["usdc_micro"] / 1_000_000},
                        )
                    except Exception as exc:
                        logger.warning("Could not refresh agent wallet balance: %s", exc)
        except SupabaseError as exc:
            logger.warning("Supabase payment bookkeeping unavailable for %s: %s", tx_hash, exc)
            if tx_hash in _used_tx_hashes:
                raise HTTPException(status_code=402, detail={"error": "Payment already used"}) from exc
            _used_tx_hashes.add(tx_hash)
    else:
        if tx_hash in _used_tx_hashes:
            raise HTTPException(status_code=402, detail={"error": "Payment already used"})
        _used_tx_hashes.add(tx_hash)


async def require_agent_payment(
    request: Request,
    agent: str,
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> dict[str, Any]:
    """
    FastAPI dependency: enforce x402 v2 payment via facilitator verify + settle.
    """
    if agent not in AGENT_PRICES:
        raise HTTPException(status_code=500, detail=f"Unknown agent pricing: {agent}")

    payment_header = _extract_payment_header(request)
    if not payment_header:
        raise payment_required_exception(agent, request)

    logger.info("x402 payment header received for agent=%s user=%s", agent, x_user_id)
    payment_payload = _decode_payment_header(payment_header)
    settlement = await _verify_and_settle(payment_payload)

    user_record: dict[str, Any] | None = None
    if x_user_id and supabase.enabled:
        try:
            user_record = await supabase.get_user_by_id(x_user_id)
        except SupabaseError as exc:
            logger.warning("Could not load user %s for payment: %s", x_user_id, exc)

    payment_mode = _resolve_payment_mode(user_record, settlement.get("payer"))
    await _record_transaction(
        agent=agent,
        user_id=x_user_id,
        user_record=user_record,
        settlement=settlement,
        payment_mode=payment_mode,
    )

    request.state.x402_settlement = settlement
    return {"mode": payment_mode, "settlement": settlement}


def agent_payment_dep(agent: str):
    async def _dep(
        request: Request,
        x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
    ) -> dict[str, Any]:
        return await require_agent_payment(request, agent, x_user_id)

    return _dep
