from __future__ import annotations

import httpx

from oscorp_agent.config import Settings


class OscorpAPIClient:
    def __init__(self, settings: Settings):
        self._base = settings.oscorp_api_url.rstrip("/")
        self._oscorp_id = settings.oscorp_id
        self._client = httpx.AsyncClient(
            base_url=self._base,
            timeout=30.0,
            headers={
                "Authorization": f"Bearer {settings.oscorp_api_key}",
                "Content-Type": "application/json",
            },
        )

    def set_oscorp_id(self, app_id: int) -> None:
        self._oscorp_id = app_id

    async def health(self) -> dict | None:
        r = await self._client.get("/health")
        if r.status_code == 200:
            return r.json()
        return None

    async def get_oscorp_state(self) -> dict | None:
        r = await self._client.get(f"/v1/oscorp/{self._oscorp_id}/state")
        if r.status_code == 200:
            return r.json()
        return None

    async def update_policy(
        self,
        *,
        approval_threshold_usdc: int,
        gtm_budget_usdc: int,
        min_patron_pulse: int,
    ) -> dict | None:
        r = await self._client.patch(
            "/v1/oscorp/policy",
            json={
                "appId": self._oscorp_id,
                "approvalThresholdUsdc": approval_threshold_usdc,
                "gtmBudgetUsdc": gtm_budget_usdc,
                "minPatronPulse": min_patron_pulse,
            },
        )
        if r.status_code in (200, 201):
            return r.json()
        return None

    async def list_services(self) -> list[dict]:
        r = await self._client.get("/v1/services")
        if r.status_code == 200:
            data = r.json()
            return data.get("data", [])
        return []

    async def register_service(
        self,
        *,
        service_name: str,
        description: str,
        price_micro_usdc: int,
        provider_address: str,
    ) -> dict | None:
        r = await self._client.put(
            f"/v1/oscorp/{self._oscorp_id}/service",
            json={
                "serviceName": service_name,
                "description": description,
                "priceMicroUsdc": price_micro_usdc,
                "providerAddress": provider_address,
            },
        )
        if r.status_code in (200, 201):
            return r.json()
        return None

    async def get_service_quote(self, provider_app_id: int) -> tuple[int, dict | None]:
        r = await self._client.get(f"/v1/oscorp/{provider_app_id}/service")
        try:
            payload = r.json()
        except Exception:
            payload = None
        return r.status_code, payload

    async def purchase_service(
        self,
        *,
        provider_app_id: int,
        payment_header: str,
        payload: dict | None = None,
    ) -> tuple[int, dict | None]:
        r = await self._client.post(
            f"/v1/oscorp/{provider_app_id}/service",
            json={"payload": payload or {}},
            headers={"X-PAYMENT": payment_header},
        )
        try:
            body = r.json()
        except Exception:
            body = None
        return r.status_code, body

    async def x402_pay(
        self,
        *,
        to: str,
        amount_micro_usdc: int,
    ) -> tuple[int, dict | None]:
        r = await self._client.post(
            f"/v1/oscorp/{self._oscorp_id}/x402/pay",
            json={"to": to, "amountMicroUsdc": amount_micro_usdc},
        )
        try:
            body = r.json()
        except Exception:
            body = None
        return r.status_code, body

    async def report_activity(self, *, type_: str, content: str, channel: str = "agent") -> dict | None:
        r = await self._client.post(
            f"/v1/oscorp/{self._oscorp_id}/activity",
            json={"type": type_, "content": content, "channel": channel},
        )
        if r.status_code in (200, 201):
            return r.json()
        return None

    async def create_oscorp(self, payload: dict) -> tuple[int, dict | None]:
        r = await self._client.post("/v1/oscorp", json=payload)
        try:
            body = r.json()
        except Exception:
            body = None
        return r.status_code, body

    async def close(self) -> None:
        await self._client.aclose()
