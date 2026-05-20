from __future__ import annotations

from algosdk import encoding


def normalize_wallet_address(address: str) -> str:
    """Canonical Algorand address so Pera/Web3Auth strings match the same user."""
    cleaned = address.strip()
    if not cleaned:
        raise ValueError("Wallet address is empty")
    return encoding.encode_address(encoding.decode_address(cleaned))
