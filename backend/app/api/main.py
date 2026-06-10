from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from app.routes import agents as agents_routes
from app.routes import analysis as analysis_routes
from app.routes import chat as chat_routes
from app.routes import session as session_routes
from app.routes import deliverables as deliverables_routes
from app.routes import users as users_routes
from app.routes import workspace as workspace_routes
from app.config.settings import settings

app = FastAPI(title=settings.app_name, version="0.5.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "PAYMENT-REQUIRED",
        "PAYMENT-RESPONSE",
        "PAYMENT-SIGNATURE",
        "X-PAYMENT",
        "X-PAYMENT-REQUIREMENTS",
        "X-PAYMENT-RESPONSE",
        "X-PAYMENT-INVALID",
    ],
)

app.include_router(session_routes.router)
app.include_router(agents_routes.router)
app.include_router(analysis_routes.router)
app.include_router(chat_routes.router)
app.include_router(users_routes.router)
app.include_router(deliverables_routes.router)
app.include_router(workspace_routes.router)


@app.middleware("http")
async def attach_x402_settlement_header(request: Request, call_next) -> Response:
    response = await call_next(request)
    settlement: dict[str, Any] | None = getattr(request.state, "x402_settlement", None)
    if settlement and response.status_code < 400:
        encoded = base64.b64encode(json.dumps(settlement, separators=(",", ":")).encode("utf-8")).decode(
            "ascii"
        )
        response.headers["PAYMENT-RESPONSE"] = encoded
        response.headers["X-PAYMENT-RESPONSE"] = encoded
    return response


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "oscorp-backend", "version": "0.5.0"}
