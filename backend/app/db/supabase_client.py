from __future__ import annotations

from typing import Any

import httpx

from app.config.settings import settings


class SupabaseError(RuntimeError):
    pass


class SupabaseClient:
    """Minimal Supabase REST client (service role)."""

    def __init__(self) -> None:
        self._base = (settings.supabase_url or "").rstrip("/")
        self._key = settings.supabase_service_key or ""
        self.enabled = bool(self._base and self._key)

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json: Any = None,
    ) -> Any:
        if not self.enabled:
            raise SupabaseError("Supabase is not configured")
        url = f"{self._base}/rest/v1/{path.lstrip('/')}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.request(method, url, headers=self._headers(), params=params, json=json)
        if res.status_code >= 400:
            raise SupabaseError(f"Supabase {method} {path} failed: {res.status_code} {res.text}")
        if res.status_code == 204 or not res.content:
            return None
        return res.json()

    async def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "users",
            params={"id": f"eq.{user_id}", "select": "*", "limit": "1"},
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        return None

    async def get_user_by_wallet(self, wallet_address: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "users",
            params={"wallet_address": f"eq.{wallet_address}", "select": "*", "limit": "1"},
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        return None

    async def upsert_user(self, wallet_address: str) -> dict[str, Any]:
        existing = await self.get_user_by_wallet(wallet_address)
        if existing:
            return existing
        rows = await self._request(
            "POST",
            "users",
            json={"wallet_address": wallet_address},
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        raise SupabaseError("Failed to create user")

    async def update_user(self, user_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        rows = await self._request(
            "PATCH",
            "users",
            params={"id": f"eq.{user_id}"},
            json=patch,
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        raise SupabaseError(f"User {user_id} not found")

    async def tx_hash_used(self, tx_hash: str) -> bool:
        rows = await self._request(
            "GET",
            "transactions",
            params={"tx_hash": f"eq.{tx_hash}", "select": "id", "limit": "1"},
        )
        return bool(isinstance(rows, list) and rows)

    async def insert_transaction(self, row: dict[str, Any]) -> dict[str, Any]:
        rows = await self._request("POST", "transactions", json=row)
        if isinstance(rows, list) and rows:
            return rows[0]
        raise SupabaseError("Failed to insert transaction")

    async def list_transactions(
        self,
        user_id: str,
        *,
        agent: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {
            "user_id": f"eq.{user_id}",
            "select": "*",
            "order": "created_at.desc",
            "limit": str(limit),
            "offset": str(offset),
        }
        if agent:
            params["agent"] = f"eq.{agent}"
        rows = await self._request("GET", "transactions", params=params)
        return rows if isinstance(rows, list) else []

    async def list_agent_deliverables(
        self,
        user_id: str,
        *,
        agent: str,
        deliverable_date: str | None = None,
        status: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {
            "user_id": f"eq.{user_id}",
            "agent": f"eq.{agent}",
            "select": "*",
            "order": "deliverable_date.desc,slot_index.asc",
        }
        if deliverable_date:
            params["deliverable_date"] = f"eq.{deliverable_date}"
        if status:
            params["status"] = f"eq.{status}"
        if limit is not None:
            params["limit"] = str(limit)
        rows = await self._request("GET", "agent_deliverables", params=params)
        return rows if isinstance(rows, list) else []

    async def insert_agent_deliverable(self, row: dict[str, Any]) -> dict[str, Any]:
        rows = await self._request("POST", "agent_deliverables", json=row)
        if isinstance(rows, list) and rows:
            return rows[0]
        raise SupabaseError("Failed to insert agent deliverable")

    async def get_agent_deliverable(self, deliverable_id: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "agent_deliverables",
            params={"id": f"eq.{deliverable_id}", "select": "*", "limit": "1"},
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        return None

    async def update_agent_deliverable(self, deliverable_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        rows = await self._request(
            "PATCH",
            "agent_deliverables",
            params={"id": f"eq.{deliverable_id}"},
            json=patch,
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        raise SupabaseError(f"Deliverable {deliverable_id} not found")

    async def get_user_workspace(self, user_id: str, site_url: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "user_workspaces",
            params={
                "user_id": f"eq.{user_id}",
                "site_url": f"eq.{site_url}",
                "select": "*",
                "limit": "1",
            },
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        return None

    async def insert_user_workspace(self, row: dict[str, Any]) -> dict[str, Any]:
        rows = await self._request("POST", "user_workspaces", json=row)
        if isinstance(rows, list) and rows:
            return rows[0]
        raise SupabaseError("Failed to insert user workspace")

    async def update_user_workspace(
        self,
        user_id: str,
        site_url: str,
        patch: dict[str, Any],
    ) -> dict[str, Any]:
        rows = await self._request(
            "PATCH",
            "user_workspaces",
            params={
                "user_id": f"eq.{user_id}",
                "site_url": f"eq.{site_url}",
            },
            json=patch,
        )
        if isinstance(rows, list) and rows:
            return rows[0]
        raise SupabaseError(f"Workspace not found for user {user_id} site {site_url}")

supabase = SupabaseClient()
