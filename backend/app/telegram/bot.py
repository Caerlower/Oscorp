from __future__ import annotations

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from app.config.settings import settings
from app.services.algorand import can_run_growth_cycle, get_agent_balances
from app.services.growth_cycle import run_growth_cycle_for_user
from app.services.regenerate import regenerate_draft_for_user
from app.services.telegram_agent import chat_with_user
from app.services.telegram_format import (
    escape_html,
    format_link_success_html,
    format_start_html,
    format_status_html,
    plain_to_telegram_html,
)
from app.services.telegram_notify import send_cycle_briefing, send_draft_with_actions
from app.store.memory import UserRecord, store


async def _notify_cycle_result(chat_id: int, out: dict) -> None:
    record = out["record"]
    result = out["result"]
    await send_cycle_briefing(
        chat_id=chat_id,
        trends=result.get("trends", {}),
        x_research=result.get("x_research", {}),
    )
    await send_draft_with_actions(
        chat_id=chat_id,
        draft_id=record.id,
        content=record.content,
        reasoning=record.reasoning,
        intent_url=record.intent_url,
        provider_outputs=record.provider_outputs,
        payment_txs=out["payment_txs"],
        category=record.category,
    )


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message:
        return
    await update.effective_message.reply_text(
        format_start_html(),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=False,
    )


async def cmd_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_chat or not update.effective_message:
        return
    if not context.args:
        await update.effective_message.reply_text(
            "<b>Usage</b>\n<code>/link &lt;user-id&gt;</code>\n\n"
            "Copy your User ID from Oscorp web → Settings.",
            parse_mode=ParseMode.HTML,
        )
        return
    user_id = context.args[0].strip()
    user = store.get_user(user_id)
    if not user:
        await update.effective_message.reply_text(
            "Unknown user ID. Connect your wallet on the web app first.",
        )
        return
    store.link_telegram(user_id, update.effective_chat.id)
    await update.effective_message.reply_text(
        format_link_success_html(),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=False,
    )


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_chat or not update.effective_message:
        return
    user = store.get_user_by_chat_id(update.effective_chat.id)
    if not user:
        await update.effective_message.reply_text(
            "Not linked. Use <code>/link &lt;user-id&gt;</code> from Settings.",
            parse_mode=ParseMode.HTML,
        )
        return
    balances = get_agent_balances(user.agent_address)
    funded = can_run_growth_cycle(balances)
    mem = user.telegram_memory
    await update.effective_message.reply_text(
        format_status_html(
            policy_signed=bool(user.policy),
            funded=funded,
            usdc_micro=int(balances.get("usdc_micro", 0)),
            draft_count=len(store.list_drafts(user.id)),
            message_count=len(mem.messages),
            summary=mem.summary[:200],
            agent_address=user.agent_address,
        ),
        parse_mode=ParseMode.HTML,
        disable_web_page_preview=False,
    )


async def cmd_memory(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message:
        return
    user = _linked_user(update)
    if not user:
        return
    mem = user.telegram_memory
    prefs = mem.preferences or {}
    notes = "\n".join(f"• {escape_html(n)}" for n in mem.feedback_notes[-6:]) or "<i>(none yet)</i>"
    prefs_text = escape_html(str(prefs)) if prefs else "<i>(from signed policy)</i>"
    summary = escape_html(mem.summary) if mem.summary else "<i>Still learning — keep chatting</i>"
    await update.effective_message.reply_text(
        f"<b>🧠 What I remember</b>\n\n"
        f"<b>Summary</b>\n{summary}\n\n"
        f"<b>Preferences</b>\n{prefs_text}\n\n"
        f"<b>Feedback</b>\n{notes}",
        parse_mode=ParseMode.HTML,
    )


async def cmd_clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message:
        return
    user = _linked_user(update)
    if not user:
        return
    store.clear_telegram_memory(user.id)
    await update.effective_message.reply_text(
        "<b>✅ Memory cleared</b>\n\n"
        "Wallet, policy, and drafts are unchanged.",
        parse_mode=ParseMode.HTML,
    )


async def cmd_run(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message or not update.effective_chat:
        return
    user = _linked_user(update)
    if not user:
        return
    await update.effective_message.reply_text(
        "<b>⏳ Running growth cycle</b>\n"
        "<i>x402 provider payments + Groq draft…</i>",
        parse_mode=ParseMode.HTML,
    )
    try:
        out = await run_growth_cycle_for_user(user)
    except ValueError as e:
        await update.effective_message.reply_text(escape_html(str(e)), parse_mode=ParseMode.HTML)
        return
    except Exception as e:
        await update.effective_message.reply_text(
            f"<b>Cycle failed</b>\n{escape_html(str(e))}",
            parse_mode=ParseMode.HTML,
        )
        return

    await _notify_cycle_result(update.effective_chat.id, out)


async def on_draft_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data or not update.effective_chat:
        return
    user = store.get_user_by_chat_id(update.effective_chat.id)
    if not user:
        await query.answer("Link account first: /link <user-id>")
        return

    data = query.data
    if data.startswith("sk:"):
        await query.answer("Skipped — say what to change next time, or tap Regenerate.")
        return

    if data.startswith("nw:"):
        await query.answer("Running new paid cycle…")
        await query.message.reply_text(  # type: ignore[union-attr]
            "<b>⏳ New draft</b>\n<i>x402 provider payments + Groq…</i>",
            parse_mode=ParseMode.HTML,
        )
        try:
            out = await run_growth_cycle_for_user(user)
        except ValueError as e:
            await query.message.reply_text(escape_html(str(e)), parse_mode=ParseMode.HTML)  # type: ignore[union-attr]
            return
        except Exception as e:
            await query.message.reply_text(
                f"<b>Cycle failed</b>\n{escape_html(str(e))}",
                parse_mode=ParseMode.HTML,
            )  # type: ignore[union-attr]
            return
        await _notify_cycle_result(update.effective_chat.id, out)
        return

    if data.startswith("rg:"):
        draft_id = data[3:]
        await query.answer("Regenerating (no extra x402 fee)…")
        try:
            record = await regenerate_draft_for_user(
                user,
                draft_id,
                feedback="Make it fresher: new opening line, different hook, same niche.",
            )
        except ValueError as e:
            await query.edit_message_reply_markup(reply_markup=None)
            await query.message.reply_text(escape_html(str(e)), parse_mode=ParseMode.HTML)  # type: ignore[union-attr]
            return
        await send_draft_with_actions(
            chat_id=update.effective_chat.id,
            draft_id=record.id,
            content=record.content,
            reasoning=record.reasoning,
            intent_url=record.intent_url,
            provider_outputs=record.provider_outputs,
            payment_txs=record.payment_txs,
            category=record.category,
        )
        return

    await query.answer()


async def handle_chat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_message or not update.effective_message.text:
        return
    user = _linked_user(update)
    if not user:
        await update.effective_message.reply_text(
            "Link your account: <code>/link &lt;user-id&gt;</code> from web Settings.",
            parse_mode=ParseMode.HTML,
        )
        return
    if not settings.groq_api_key:
        await update.effective_message.reply_text(
            "Chat needs <code>GROQ_API_KEY</code>. You can still use <code>/run</code> and <code>/status</code>.",
            parse_mode=ParseMode.HTML,
        )
        return

    await update.effective_message.chat.send_action("typing")
    reply = await chat_with_user(user=user, message=update.effective_message.text.strip())
    await update.effective_message.reply_text(
        plain_to_telegram_html(reply.text),
        parse_mode=ParseMode.HTML,
    )


def _linked_user(update: Update):
    if not update.effective_chat:
        return None
    user = store.get_user_by_chat_id(update.effective_chat.id)
    if not user and update.effective_message:
        update.effective_message.reply_text(
            "Not linked. <code>/link &lt;user-id&gt;</code>",
            parse_mode=ParseMode.HTML,
        )
    return user


def build_telegram_app() -> Application:
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")
    app = Application.builder().token(settings.telegram_bot_token).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("memory", cmd_memory))
    app.add_handler(CommandHandler("clear", cmd_clear))
    app.add_handler(CommandHandler("run", cmd_run))
    app.add_handler(CallbackQueryHandler(on_draft_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_chat))
    return app
