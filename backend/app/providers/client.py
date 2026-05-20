from __future__ import annotations

from typing import Any

import httpx

from app.config.settings import settings
from app.providers.stubs import stub_provider_response

DEV_STACK_HINT = (
    "Paid provider stack is not reachable. Start these in separate terminals:\n"
    "  cd Oscorp/x402-payer && npm run dev                    # :8110\n"
    "  cd Oscorp/provider-services/trend-analyzer && npm run dev  # :8101\n"
    "  cd Oscorp/provider-services/hook-generator && npm run dev    # :8102\n"
    "Or set OSCORP_PROVIDER_STUB=true in backend/.env to skip x402 for local testing."
)


class ProviderUnavailableError(RuntimeError):
    """x402-payer or provider service is down."""


class ProviderClient:
    """Paid provider calls via official x402 payer."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def call(
        self,
        *,
        path: str,
        payload: dict[str, Any],
        agent_mnemonic: str,
    ) -> dict[str, Any]:
        if settings.provider_stub_mode:
            return stub_provider_response(path, payload)

        body: dict[str, Any] = {
            "url": f"{self.base_url}{path}",
            "method": "POST",
            "json": payload,
            "payerMnemonic": agent_mnemonic,
        }
        payer_url = f"{settings.x402_payer_url.rstrip('/')}/fetch"
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(payer_url, json=body)
                try:
                    result = response.json()
                except Exception as exc:
                    response.raise_for_status()
                    raise ProviderUnavailableError(
                        f"x402-payer returned non-JSON ({response.status_code}): {response.text[:200]}"
                    ) from exc

                if response.status_code >= 400:
                    inner = result.get("body") if isinstance(result.get("body"), dict) else {}
                    detail = inner.get("error") or result.get("statusText") or response.text[:200]
                    raise ProviderUnavailableError(
                        f"x402-payer error ({response.status_code}): {detail}. "
                        f"Is trend-analyzer (:8101) and hook-generator (:8102) running? "
                        f"Restart x402-payer after `npm install` in x402-payer/."
                    )
        except httpx.ConnectError as exc:
            raise ProviderUnavailableError(DEV_STACK_HINT) from exc
        except ProviderUnavailableError:
            raise
        except httpx.HTTPError as exc:
            raise ProviderUnavailableError(
                f"x402-payer request failed ({payer_url}): {exc}"
            ) from exc

        if not result.get("ok"):
            status = result.get("status")
            body = result.get("body")
            hint = result.get("hint") or ""
            payer = result.get("payer") or "unknown"
            msg = f"x402 payment failed (HTTP {status}) from agent {payer}. Response: {body}"
            if hint:
                msg = f"{msg}. {hint}"
            if status == 402:
                msg += (
                    " Check agent USDC balance (~$0.02 needed per cycle), USDC opt-in, "
                    "and restart x402-payer after code updates."
                )
            raise RuntimeError(msg)
        body_out = result.get("body") or {}
        if isinstance(body_out, dict):
            payment = result.get("payment") or {}
            tx_id = ""
            if isinstance(payment, dict):
                tx_id = str(payment.get("transaction") or payment.get("txId") or "")
            body_out["_payment_tx"] = tx_id
            body_out["_payment"] = payment
        return body_out


def trend_client() -> ProviderClient:
    return ProviderClient(settings.trend_analyzer_url)


def hook_client() -> ProviderClient:
    return ProviderClient(settings.hook_generator_url)


def thread_client() -> ProviderClient:
    return ProviderClient(settings.thread_generator_url)
