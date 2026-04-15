from __future__ import annotations

import ast
import asyncio
import signal
from datetime import datetime, timezone
from typing import Any

from rich.console import Console

from oscorp_agent.agent_loop import run_agent_cycle
from oscorp_agent.api_client import OscorpAPIClient
from oscorp_agent.config import Settings, resolve_llm_api_key

console = Console()


def _fmt_usdc_micro(value: Any) -> str:
    try:
        micro = int(value)
    except Exception:
        return str(value)
    return f"${micro / 1_000_000:.6f} USDC ({micro} micro)"


def _parse_step_result(raw: str) -> tuple[str, Any]:
    if "=" not in raw:
        return raw.strip(), None
    name, payload = raw.split("=", 1)
    name = name.strip()
    payload = payload.strip()
    try:
        parsed = ast.literal_eval(payload)
    except Exception:
        parsed = payload
    return name, parsed


def _print_pretty_cycle_result(action: str, settings: Settings) -> None:
    steps = [s.strip() for s in action.split(" | ") if s.strip()]
    if not steps:
        console.print("[yellow]No actions emitted this cycle.[/yellow]")
        return

    console.print("[bold magenta]GTM cycle execution[/bold magenta]")
    hidden_activity_logs = 0
    summary_bits: list[str] = []
    payment_proof: dict[str, Any] = {}
    drafted_post: str | None = None
    campaign_objective: str | None = None
    registered_service_name: str | None = None
    discovered_count: int | None = None
    for idx, step in enumerate(steps, start=1):
        name, payload = _parse_step_result(step)
        if name.startswith("llm_tool_call_error_recovered"):
            console.print(f"  {idx}. [yellow]Recovered from tool-call formatting issue[/yellow]")
            console.print(f"     [dim]{step}[/dim]")
            continue
        if name == "final":
            console.print(f"  {idx}. [cyan]Agent summary:[/cyan] {payload}")
            continue

        if name == "post_to_x" and isinstance(payload, dict):
            status = payload.get("status")
            if status == "queued_for_x_access":
                queued = payload.get("queued_text")
                if isinstance(queued, str):
                    drafted_post = queued
                if not settings.agent_presentation_mode:
                    console.print(f"  {idx}. [blue]Prepared X post (queued):[/blue] {payload.get('queued_text')}")
                x402 = payload.get("x402", {})
                if isinstance(x402, dict):
                    tx_id = x402.get("tx_id")
                    amount = x402.get("amountMicroUsdc")
                    if amount is not None:
                        payment_proof["amountMicroUsdc"] = amount
                    if tx_id:
                        tx_link = f"{settings.tx_explorer_base_url.rstrip('/')}/{tx_id}"
                        if not settings.agent_presentation_mode:
                            console.print(f"     [green]x402 deduction confirmed[/green]: txId={tx_id}")
                            console.print(f"     [dim]Explorer/API:[/dim] {tx_link}")
                        payment_proof["txId"] = tx_id
                        payment_proof["link"] = tx_link
                        payment_proof["status"] = "confirmed"
                        summary_bits.append("x402 paid (queued post)")
                    else:
                        if not settings.agent_presentation_mode:
                            console.print("     [yellow]x402 tx id not available in this step[/yellow]")
                        payment_proof["status"] = "pending_or_missing_txid"
                summary_bits.append("X post queued")
            elif status == "duplicate_skipped":
                duplicate_text = str(payload.get("queued_text", "")).strip()
                if duplicate_text:
                    drafted_post = duplicate_text
                console.print(
                    "[yellow]Duplicate content detected. Skipping X action and skipping x402 payment.[/yellow]"
                )
                summary_bits.append("duplicate X content skipped")
            elif status == "posted":
                if not settings.agent_presentation_mode:
                    console.print(f"  {idx}. [green]Posted to X successfully[/green]")
                summary_bits.append("X posted")
            else:
                if not settings.agent_presentation_mode:
                    console.print(f"  {idx}. [yellow]X step result[/yellow]: {payload}")
            continue

        if name in {"purchase_service", "x402_pay"} and isinstance(payload, dict):
            tx_id = payload.get("tx_id") or payload.get("txId")
            amount = payload.get("amountMicroUsdc")
            if amount is None and isinstance(payload.get("buy_result"), dict):
                transfer = payload["buy_result"].get("transfer", {})
                if isinstance(transfer, dict):
                    amount = transfer.get("amountMicroUsdc")
            if not settings.agent_presentation_mode:
                console.print(f"  {idx}. [green]{name.replace('_', ' ').title()}[/green]")
            if amount is not None:
                if not settings.agent_presentation_mode:
                    console.print(f"     amount: {_fmt_usdc_micro(amount)}")
                payment_proof["amountMicroUsdc"] = amount
            if tx_id:
                tx_link = f"{settings.tx_explorer_base_url.rstrip('/')}/{tx_id}"
                if not settings.agent_presentation_mode:
                    console.print(f"     txId: {tx_id}")
                    console.print(f"     [dim]Explorer/API:[/dim] {tx_link}")
                payment_proof["txId"] = tx_id
                payment_proof["link"] = tx_link
                payment_proof["status"] = "confirmed"
                summary_bits.append("x402 tx confirmed")
            else:
                if not settings.agent_presentation_mode:
                    console.print("     [yellow]No tx id returned for this step[/yellow]")
                payment_proof.setdefault("status", "pending_or_missing_txid")
            continue

        if name == "discover_services" and isinstance(payload, list):
            names = [str(item.get("serviceName", "unknown")) for item in payload[:3] if isinstance(item, dict)]
            discovered_count = len(payload)
            if not settings.agent_presentation_mode:
                console.print(
                    f"  {idx}. [green]Service discovery[/green]: found {len(payload)} services"
                    + (f" ({', '.join(names)})" if names else "")
                )
            summary_bits.append("services discovered")
            continue

        if name == "register_service" and isinstance(payload, dict):
            price = payload.get("priceMicroUsdc")
            registered_service_name = str(payload.get("serviceName", "service"))
            if not settings.agent_presentation_mode:
                console.print(f"  {idx}. [green]Registered service[/green]: {payload.get('serviceName')}")
            if price is not None:
                if not settings.agent_presentation_mode:
                    console.print(f"     price: {_fmt_usdc_micro(price)}")
            summary_bits.append("service registered")
            continue

        if name == "create_campaign_brief" and isinstance(payload, dict):
            campaign_objective = str(payload.get("objective", "GTM execution"))
            if not settings.agent_presentation_mode:
                console.print(
                    f"  {idx}. [green]Campaign brief[/green]: objective={payload.get('objective')} "
                    f"channel={payload.get('channel')} budget={payload.get('budget_usdc')} USDC"
                )
            summary_bits.append("campaign brief created")
            continue

        if name == "draft_social_post" and isinstance(payload, dict):
            drafted_post = str(payload.get("content", ""))
            if not settings.agent_presentation_mode:
                console.print(f"  {idx}. [green]Drafted social post[/green]: {payload.get('content')}")
            summary_bits.append("social draft created")
            continue

        if name == "report_activity" and isinstance(payload, dict):
            hidden_activity_logs += 1
            continue

        if not settings.agent_presentation_mode:
            console.print(f"  {idx}. [green]{name}[/green]: {payload}")

    if hidden_activity_logs and not settings.agent_presentation_mode:
        console.print(f"  - [dim]Internal activity logs recorded:[/dim] {hidden_activity_logs}")

    if settings.agent_presentation_mode:
        if campaign_objective:
            console.print(f"[bold]Decision:[/bold] Focus this cycle on [cyan]{campaign_objective}[/cyan].")
        if drafted_post:
            console.print(f"[bold]Generated copy:[/bold] {drafted_post}")
        if registered_service_name:
            console.print(f"[bold]Service readiness:[/bold] {registered_service_name} is available for purchase.")
        if discovered_count is not None:
            console.print(f"[bold]Market scan:[/bold] Found {discovered_count} matching services.")
        if payment_proof:
            console.print("[bold green]Payment proof[/bold green]")
            amount = payment_proof.get("amountMicroUsdc")
            if amount is not None:
                console.print(f"  deducted: {_fmt_usdc_micro(amount)}")
            console.print(f"  status: {payment_proof.get('status', 'unknown')}")
            if payment_proof.get("txId"):
                console.print(f"  tx id: {payment_proof['txId']}")
            if payment_proof.get("link"):
                console.print(f"  link: {payment_proof['link']}")
        else:
            console.print("[yellow]No payment was executed in this cycle.[/yellow]")
        return

    if summary_bits:
        unique_bits: list[str] = []
        for bit in summary_bits:
            if bit not in unique_bits:
                unique_bits.append(bit)
        console.print(f"[bold cyan]Cycle summary:[/bold cyan] {' -> '.join(unique_bits)}")

    if payment_proof:
        console.print("[bold green]Payment Proof[/bold green]")
        amount = payment_proof.get("amountMicroUsdc")
        if amount is not None:
            console.print(f"  amount: {_fmt_usdc_micro(amount)}")
        console.print(f"  status: {payment_proof.get('status', 'unknown')}")
        if payment_proof.get("txId"):
            console.print(f"  txId: {payment_proof['txId']}")
        if payment_proof.get("link"):
            console.print(f"  explorer: {payment_proof['link']}")


async def run(settings: Settings) -> None:
    api = OscorpAPIClient(settings)

    health = await api.health()
    if not health:
        console.print("[red]Oscorp backend is not reachable.[/red]")
        await api.close()
        return

    console.print("[green]Oscorp backend reachable.[/green]")
    console.print(f"[bold]Oscorp app id:[/bold] {settings.oscorp_id}")
    recent_actions: list[str] = []
    cycle = 0

    shutdown_event = asyncio.Event()

    def _handle_signal():
        shutdown_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal)

    try:
        while not shutdown_event.is_set():
            cycle += 1
            if settings.agent_verbose:
                console.print(f"\n[bold cyan]Cycle {cycle}[/bold cyan]")
                console.print("[dim]Thinking, evaluating tools, and executing actions...[/dim]")
            state = await api.get_oscorp_state()
            if not state:
                console.print("[yellow]Could not fetch Oscorp state this cycle.[/yellow]")
            elif resolve_llm_api_key(settings):
                if settings.agent_verbose:
                    gs = state.get("globalState", {})
                    name = gs.get("oscorpName") if isinstance(gs, dict) else None
                    budget = gs.get("gtmBudgetUsdc") if isinstance(gs, dict) else None
                    if name:
                        console.print(f"[dim]Company:[/dim] {name}")
                    if budget is not None:
                        console.print(f"[dim]GTM budget:[/dim] {budget} USDC")
                    console.print(f"[dim]Mode:[/dim] {settings.agent_mode}")
                try:
                    action = await run_agent_cycle(settings, api, state, recent_actions=recent_actions[-5:])
                    if settings.agent_verbose:
                        _print_pretty_cycle_result(action, settings)
                    else:
                        console.print(f"[blue]Cycle result:[/blue] {action}")
                    recent_actions.append(action)
                except Exception as exc:
                    msg = str(exc)
                    status_code = getattr(exc, "status_code", None)
                    is_rate_limit = (
                        status_code == 429
                        or type(exc).__name__.lower() == "ratelimiterror"
                        or ("rate limit" in msg.lower() and "429" in msg)
                    )
                    if is_rate_limit:
                        console.print("[yellow]LLM rate limit reached.[/yellow]")
                        console.print(
                            f"[dim]Time:[/dim] {datetime.now(timezone.utc).isoformat()} "
                            "- waiting for next cycle automatically."
                        )
                    else:
                        console.print(f"[red]Cycle execution error:[/red] {type(exc).__name__}: {exc}")
            else:
                console.print("[yellow]GROQ_API_KEY / OPENAI_API_KEY not set; state fetched without planning.[/yellow]")

            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=settings.agent_cycle_interval)
                break
            except asyncio.TimeoutError:
                pass
    finally:
        await api.close()
        console.print("[bold]Oscorp agent stopped.[/bold]")
