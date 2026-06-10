from __future__ import annotations

from algosdk import encoding


def normalize_address(addr: str) -> str:
    try:
        return encoding.encode_address(encoding.decode_address(addr))
    except Exception:
        return addr


# Alias used by session and agent wallet routes.
normalize_wallet_address = normalize_address
