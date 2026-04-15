from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from uuid import uuid4


def build_x402_payment_header(*, payer_app_id: int, amount_micro_usdc: int, tx_id: str) -> str:
    payload = {
        "payerAppId": payer_app_id,
        "amountMicroUsdc": amount_micro_usdc,
        "txId": tx_id,
        "nonce": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    token = base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
    return f"x402 {token}"
