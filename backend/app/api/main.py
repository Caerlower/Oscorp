from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import agent as agent_routes
from app.api.routes import drafts as drafts_routes
from app.api.routes import session as session_routes
from app.config.settings import settings

app = FastAPI(title=settings.app_name, version="0.4.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session_routes.router)
app.include_router(agent_routes.router)
app.include_router(drafts_routes.router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "oscorp-backend", "version": "0.4.0"}
