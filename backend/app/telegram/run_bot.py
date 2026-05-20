"""Oscorp Telegram polling bot (TELEGRAM_OPERATOR=oscorp)."""

from __future__ import annotations

import asyncio
import sys

from app.config.settings import settings
from app.telegram.bot import build_telegram_app


async def _run_polling() -> None:
    """Explicit async lifecycle — avoids PTB 22 + Python 3.12 run_polling() init bug."""
    application = build_telegram_app()
    await application.initialize()
    try:
        await application.start()
        if not application.updater:
            raise RuntimeError("Application has no Updater")
        await application.updater.start_polling(drop_pending_updates=True)
        print("Oscorp Telegram bot polling (TELEGRAM_OPERATOR=oscorp)…")
        print("Commands: /start /link /run /status /memory /clear")
        print("Drafts: Lora tx links in message + ↗ Trend tx / ↗ Hook tx buttons")
        await asyncio.Event().wait()
    finally:
        if application.updater and application.updater.running:
            await application.updater.stop()
        if application.running:
            await application.stop()
        await application.shutdown()


def main() -> None:
    if not settings.telegram_bot_token:
        print("Set TELEGRAM_BOT_TOKEN in backend/.env", file=sys.stderr)
        sys.exit(1)
    try:
        asyncio.run(_run_polling())
    except KeyboardInterrupt:
        print("\nTelegram bot stopped.")


if __name__ == "__main__":
    main()
