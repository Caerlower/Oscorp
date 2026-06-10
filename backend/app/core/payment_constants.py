"""Hardcoded payment constants — loaded from shared/payment-constants.json."""

from __future__ import annotations

import json
from pathlib import Path

_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "shared" / "payment-constants.json"
_MANIFEST = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))

# Replace treasury in shared/payment-constants.json before mainnet launch.
RECIPIENT_ADDRESS: str = _MANIFEST["recipientAddress"]

# GoPlausible facilitator fee payer (algorand-testnet / CAIP-2 testnet).
FACILITATOR_FEE_PAYER: str = _MANIFEST["facilitatorFeePayer"]

AGENT_PRICES: dict[str, float] = {
    key: float(value) for key, value in _MANIFEST["agentPrices"].items()
}

USDC_DECIMALS = 6


def usdc_to_micro(amount: float) -> int:
    return int(round(amount * 10**USDC_DECIMALS))
