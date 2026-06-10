from __future__ import annotations

import time

from algosdk import account, encoding, mnemonic, transaction
from algosdk.v2client import algod

from app.config.settings import settings

# Target ALGO balance on agent wallet (fees + opt-in) when user clicks Fund
TARGET_AGENT_ALGO_MICRO = 1_000_000

# Minimum USDC to run one growth cycle (trend + hook ~$0.02 + buffer)
MIN_CYCLE_USDC_MICRO = 50_000


def generate_agent_wallet() -> tuple[str, str]:
    private_key, address = account.generate_account()
    return address, mnemonic.from_private_key(private_key)


def make_algod() -> algod.AlgodClient:
    return algod.AlgodClient(settings.algod_token, settings.algod_address)


def _wait_confirmed(client: algod.AlgodClient, txid: str, timeout_rounds: int = 20) -> None:
    status = client.pending_transaction_info(txid)
    start = status.get("confirmed-round", 0)
    if start:
        return
    last = client.status().get("last-round", 0)
    for _ in range(timeout_rounds):
        if client.pending_transaction_info(txid).get("confirmed-round"):
            return
        client.status_after_block(last + 1)
        last += 1
    raise TimeoutError(f"Transaction {txid} not confirmed in time")


def get_agent_balances(agent_address: str) -> dict[str, int | bool]:
    client = make_algod()
    account_info = client.account_info(agent_address)
    algo_micro = int(account_info.get("amount", 0))
    usdc_micro = 0
    usdc_opted_in = False
    for asset in account_info.get("assets", []):
        if asset.get("asset-id") == settings.usdc_asset_id:
            usdc_micro = int(asset.get("amount", 0))
            usdc_opted_in = True
            break
    return {
        "algo_micro": algo_micro,
        "usdc_micro": usdc_micro,
        "usdc_opted_in": usdc_opted_in,
    }


def is_agent_funded(balances: dict[str, int | bool], min_usdc_micro: int) -> bool:
    return bool(balances.get("usdc_opted_in")) and int(balances.get("usdc_micro", 0)) >= min_usdc_micro


def can_run_growth_cycle(balances: dict[str, int | bool]) -> bool:
    """Enough USDC to pay x402 providers for one cycle (not full policy spend cap)."""
    return is_agent_funded(balances, MIN_CYCLE_USDC_MICRO)


def opt_in_agent_usdc(agent_address: str, agent_mnemonic: str) -> str | None:
    """
    Opt the agent wallet into TestNet USDC (ASA). Must be signed by the agent account.
    Returns txid if a transaction was sent, None if already opted in.
    """
    balances = get_agent_balances(agent_address)
    if balances["usdc_opted_in"]:
        return None

    if int(balances["algo_micro"]) < 100_000:
        raise ValueError(
            "Agent wallet needs TestNet ALGO for fees before USDC opt-in. "
            "Send ~0.1 ALGO to the agent address, or set DEV_FAUCET_MNEMONIC in backend/.env."
        )

    client = make_algod()
    sk = mnemonic.to_private_key(agent_mnemonic)
    sp = client.suggested_params()
    txn = transaction.AssetTransferTxn(
        sender=agent_address,
        sp=sp,
        receiver=agent_address,
        amt=0,
        index=settings.usdc_asset_id,
    )
    txid = client.send_transaction(txn.sign(sk))
    _wait_confirmed(client, txid)
    return txid


def bootstrap_agent_algo(agent_address: str, funder_mnemonic: str, micro_algo: int = 300_000) -> str | None:
    """Send TestNet ALGO to a new agent wallet (dev faucet). Returns txid or None if skipped."""
    balances = get_agent_balances(agent_address)
    if int(balances["algo_micro"]) >= 100_000:
        return None

    client = make_algod()
    sk = mnemonic.to_private_key(funder_mnemonic)
    sender = account.address_from_private_key(sk)
    funder_bal = get_agent_balances(sender)
    if int(funder_bal["algo_micro"]) < micro_algo + 50_000:
        raise ValueError("Dev faucet account is low on TestNet ALGO")

    sp = client.suggested_params()
    txn = transaction.PaymentTxn(
        sender=sender,
        sp=sp,
        receiver=agent_address,
        amt=micro_algo,
    )
    txid = client.send_transaction(txn.sign(sk))
    _wait_confirmed(client, txid)
    return txid


def build_algo_payment_txn(*, user_address: str, agent_address: str) -> dict[str, str | int] | None:
    """Step 1: single ALGO payment user → agent (one wallet popup)."""
    agent_bal = get_agent_balances(agent_address)
    algo_topup = max(0, TARGET_AGENT_ALGO_MICRO - int(agent_bal["algo_micro"]))
    if algo_topup <= 0:
        return None

    client = make_algod()
    sp = client.suggested_params()
    txn = transaction.PaymentTxn(
        sender=user_address,
        sp=sp,
        receiver=agent_address,
        amt=algo_topup,
    )
    return {
        "transaction": encoding.msgpack_encode(txn),
        "algo_micro": algo_topup,
    }


def prepare_agent_usdc_optin(agent_address: str, agent_mnemonic: str) -> dict[str, int | bool | str | None]:
    """
    Step 2 (server): after ALGO lands, opt agent into USDC. Polls briefly for ALGO confirmation.
    """
    for _ in range(24):
        balances = get_agent_balances(agent_address)
        if int(balances["algo_micro"]) >= 100_000:
            break
        time.sleep(1.0)
    else:
        raise ValueError(
            "Agent has not received ALGO yet. Confirm the payment in your wallet, then click Fund again."
        )

    balances = get_agent_balances(agent_address)
    optin_tx: str | None = None
    if not balances["usdc_opted_in"]:
        optin_tx = opt_in_agent_usdc(agent_address, agent_mnemonic)
        time.sleep(0.5)
        balances = get_agent_balances(agent_address)

    if not balances["usdc_opted_in"]:
        raise ValueError("Agent USDC opt-in failed. Retry Fund agent.")

    return {
        **balances,
        "optin_tx": optin_tx,
    }


def build_usdc_funding_txns(
    *,
    user_address: str,
    agent_address: str,
    usdc_amount_micro: int,
) -> dict[str, list[str] | list[int] | int]:
    """Step 3: user USDC opt-in (if needed) + USDC transfer (second wallet popup)."""
    agent_bal = get_agent_balances(agent_address)
    if not agent_bal["usdc_opted_in"]:
        raise ValueError("Agent must be opted into USDC before receiving USDC. Run Fund from step 1.")

    client = make_algod()
    sp = client.suggested_params()
    user_bal = get_agent_balances(user_address)
    tx_list: list[transaction.Transaction] = []

    if not user_bal["usdc_opted_in"]:
        tx_list.append(
            transaction.AssetTransferTxn(
                sender=user_address,
                sp=sp,
                receiver=user_address,
                amt=0,
                index=settings.usdc_asset_id,
            )
        )

    tx_list.append(
        transaction.AssetTransferTxn(
            sender=user_address,
            sp=sp,
            receiver=agent_address,
            amt=usdc_amount_micro,
            index=settings.usdc_asset_id,
        )
    )

    if len(tx_list) > 1:
        tx_list = transaction.assign_group_id(tx_list)

    encoded = [encoding.msgpack_encode(tx) for tx in tx_list]
    return {
        "transactions": encoded,
        "indexes_to_sign": list(range(len(encoded))),
        "usdc_amount_micro": usdc_amount_micro,
    }


def ensure_agent_usdc_ready(agent_address: str, agent_mnemonic: str) -> dict[str, int | bool | str | None]:
    """
    Ensure agent can receive USDC: bootstrap ALGO (optional faucet), then ASA opt-in.
    """
    bootstrap_tx: str | None = None
    optin_tx: str | None = None

    if settings.dev_faucet_mnemonic:
        try:
            bootstrap_tx = bootstrap_agent_algo(agent_address, settings.dev_faucet_mnemonic)
        except ValueError:
            pass

    balances = get_agent_balances(agent_address)
    if not balances["usdc_opted_in"]:
        optin_tx = opt_in_agent_usdc(agent_address, agent_mnemonic)
        time.sleep(0.5)
        balances = get_agent_balances(agent_address)

    return {
        **balances,
        "bootstrap_tx": bootstrap_tx,
        "optin_tx": optin_tx,
    }
