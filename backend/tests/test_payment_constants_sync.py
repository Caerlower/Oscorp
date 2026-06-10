"""Ensure backend payment constants stay aligned with shared/payment-constants.json."""

from __future__ import annotations

import json
from pathlib import Path

from app.core import payment_constants

_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "shared" / "payment-constants.json"


def _load_manifest() -> dict:
    return json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))


def test_manifest_exists() -> None:
    assert _MANIFEST_PATH.is_file()


def test_recipient_address_matches_manifest() -> None:
    manifest = _load_manifest()
    assert payment_constants.RECIPIENT_ADDRESS == manifest["recipientAddress"]


def test_facilitator_fee_payer_matches_manifest() -> None:
    manifest = _load_manifest()
    assert payment_constants.FACILITATOR_FEE_PAYER == manifest["facilitatorFeePayer"]


def test_agent_prices_match_manifest() -> None:
    manifest = _load_manifest()
    expected = {key: float(value) for key, value in manifest["agentPrices"].items()}
    assert payment_constants.AGENT_PRICES == expected


def test_paid_agents_are_subset_with_matching_prices() -> None:
    manifest = _load_manifest()
    agent_prices = manifest["agentPrices"]
    for agent in manifest["paidAgents"]:
        assert agent in agent_prices
        assert payment_constants.AGENT_PRICES[agent] == float(agent_prices[agent])
