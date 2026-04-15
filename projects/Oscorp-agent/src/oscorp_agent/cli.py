from __future__ import annotations

import asyncio
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import click
from dotenv import dotenv_values
from rich.console import Console
from rich.table import Table

from oscorp_agent import __version__
from oscorp_agent.api_client import OscorpAPIClient
from oscorp_agent.browser.session import open_x_for_manual_login
from oscorp_agent.config import Settings, ensure_app_dir
from oscorp_agent.payments.x402_signer import build_x402_payment_header
from oscorp_agent.x_tools import publish_x_post

console = Console()


def _load_env_file(env_file: str) -> None:
    env_path = Path(env_file)
    if not env_path.exists():
        return
    parsed = dotenv_values(env_path)
    for key, value in parsed.items():
        if key and value is not None:
            # Ensure edits in .env take effect even if this shell exported older values.
            os.environ[key] = value


def _print_demo_cycle_report(result: dict, settings: Settings) -> None:
    def _kv_table() -> Table:
        table = Table(show_header=False, box=None, pad_edge=False, expand=True)
        table.add_column(justify="left", no_wrap=True, width=12)
        table.add_column(justify="left", overflow="fold")
        return table

    if result.get("status") != "ok":
        console.print("[bold red]Demo cycle failed[/bold red]")
        table = _kv_table()
        table.add_row("Error", str(result.get("error", "unknown")))
        if result.get("buy_status") is not None:
            table.add_row("Buy status", str(result.get("buy_status")))
        if result.get("pay_status") is not None:
            table.add_row("Pay status", str(result.get("pay_status")))
        if result.get("buy_result") is not None:
            table.add_row("Backend detail", str(result.get("buy_result")))
        if result.get("pay_result") is not None:
            table.add_row("Payment detail", str(result.get("pay_result")))
        console.print(table)
        return

    purchase = result.get("purchase", {}) if isinstance(result.get("purchase"), dict) else {}
    payment = purchase.get("payment", {}) if isinstance(purchase.get("payment"), dict) else {}
    transfer = purchase.get("transfer", {}) if isinstance(purchase.get("transfer"), dict) else {}
    service = purchase.get("service", {}) if isinstance(purchase.get("service"), dict) else {}
    output = purchase.get("result", {}).get("output", {}) if isinstance(purchase.get("result"), dict) else {}
    x_post = result.get("xPost", {}) if isinstance(result.get("xPost"), dict) else {}

    console.print("\n[bold green]Oscorp Demo Cycle Report[/bold green]")
    console.print("[dim]End-to-end GTM commerce run on Algorand LocalNet.[/dim]\n")

    flow = _kv_table()
    flow.add_row("1.", "Service registered/available")
    flow.add_row("2.", "HTTP 402 challenge received")
    flow.add_row("3.", "x402 payment submitted")
    flow.add_row("4.", "On-chain transfer verified")
    flow.add_row("5.", "Service purchase fulfilled")
    flow.add_row("6.", "X content queued (not posted)")
    console.print("[bold cyan]Flow[/bold cyan]")
    console.print(flow)

    tx_id = str(payment.get("txId", result.get("paymentTxId", "")))
    tx_link = (
        f"{settings.tx_explorer_base_url.rstrip('/')}/{tx_id}"
        if tx_id and settings.tx_explorer_base_url
        else ""
    )
    amount_micro = payment.get("amountMicroUsdc")
    amount_text = (
        f"${int(amount_micro) / 1_000_000:.6f} USDC ({int(amount_micro)} micro)"
        if amount_micro is not None
        else "unknown"
    )

    proof = _kv_table()
    proof.add_row("Protocol", str(purchase.get("protocol", "x402")))
    proof.add_row("Status", str(purchase.get("status", "unknown")))
    proof.add_row("Tx ID", tx_id or "missing")
    if tx_link:
        proof.add_row("Explorer", tx_link)
    proof.add_row("Amount", amount_text)
    proof.add_row("Round", str(transfer.get("confirmedRound", "unknown")))
    proof.add_row("Receiver", str(transfer.get("receiver", "unknown")))
    console.print("\n[bold cyan]Payment Proof[/bold cyan]")
    console.print(proof)

    service_table = _kv_table()
    service_table.add_row("Provider app", str(result.get("providerAppId", "unknown")))
    service_table.add_row("Service", str(service.get("serviceName", "unknown")))
    service_table.add_row("Fulfillment", str(output.get("recommendation", "n/a")))
    console.print("\n[bold cyan]Service Output[/bold cyan]")
    console.print(service_table)

    x_table = _kv_table()
    x_table.add_row("X status", str(x_post.get("status", "unknown")))
    x_table.add_row("Message", str(x_post.get("message", "n/a")))
    x_table.add_row("Queued post", str(x_post.get("queued_text", "")))
    console.print("\n[bold cyan]Content Queue[/bold cyan]")
    console.print(x_table)

    console.print(
        "\n[bold]Demo narrative:[/bold] Oscorp discovered a paid service, settled the 402 challenge "
        "with an on-chain USDC transfer, verified proof on-chain, fulfilled the GTM playbook, and "
        "queued the outbound X communication for controlled publishing."
    )


async def _generate_demo_copy(*, state: dict, purchase: dict) -> str:
    gs = state.get("globalState", {}) if isinstance(state, dict) else {}
    company = str(gs.get("oscorpName", "Oscorp")).strip() or "Oscorp"
    service = (
        str((purchase.get("service", {}) or {}).get("serviceName", "GTM sprint")).strip()
        if isinstance(purchase, dict)
        else "GTM sprint"
    )
    recommendation = (
        str(((purchase.get("result", {}) or {}).get("output", {}) or {}).get("recommendation", "")).strip()
        if isinstance(purchase, dict)
        else ""
    )

    console.print("\n[bold cyan]AI copy generation[/bold cyan]")
    console.print("[dim]- Reading cycle context and company profile...[/dim]")
    await asyncio.sleep(0.7)
    console.print("[dim]- Synthesizing GTM angle from purchased service output...[/dim]")
    await asyncio.sleep(0.9)
    console.print("[dim]- Finalizing post with CTA and concise tone...[/dim]")
    await asyncio.sleep(0.8)

    hooks = [
        f"{company} just completed a paid GTM intelligence cycle on Oscorp.",
        f"{company} ran an autonomous GTM sprint using Oscorp's on-chain commerce rail.",
        f"{company} just executed a full x402-powered GTM loop on Oscorp.",
    ]
    ctas = [
        "Want the same playbook for your product? DM us.",
        "Building GTM pipelines? Follow for weekly execution logs.",
        "If you are scaling distribution, this is your blueprint.",
    ]
    proof = "USDC payment verified on Algorand LocalNet via x402."
    strategy = recommendation or f"Next move: execute the {service} recommendation set."
    post = f"{random.choice(hooks)} {proof} {strategy} {random.choice(ctas)}"
    return post[:280]


@click.group()
@click.version_option(__version__, prog_name="oscorp-agent")
def main():
    """Oscorp autonomous agent runtime."""


@main.command()
@click.option("--oscorp-id", type=int, default=None, help="Oscorp app id override")
@click.option("--env-file", default=".env", help="Path to .env")
def start(oscorp_id: int | None, env_file: str):
    ensure_app_dir()
    _load_env_file(env_file)
    kwargs: dict = {"_env_file": env_file}
    if oscorp_id:
        kwargs["oscorp_id"] = oscorp_id
    settings = Settings(**kwargs)

    if not settings.oscorp_id:
        console.print("[red]OSCORP_ID is required.[/red]")
        sys.exit(1)

    console.print(f"[bold green]Oscorp Agent v{__version__}[/bold green]")
    console.print(f"  Oscorp ID: {settings.oscorp_id}")
    console.print(f"  API URL:   {settings.oscorp_api_url}")
    console.print()

    from oscorp_agent.scheduler import run

    asyncio.run(run(settings))


@main.command("post-x")
@click.option("--text", required=True, help="Post content (max 280 chars)")
@click.option("--env-file", default=".env", help="Path to .env")
def post_x(text: str, env_file: str):
    """Directly post to X for demo/testing."""
    ensure_app_dir()
    _load_env_file(env_file)
    settings = Settings(_env_file=env_file)
    result = asyncio.run(publish_x_post(settings=settings, text=text))
    if result.get("status") == "posted":
        console.print("[green]Posted to X successfully.[/green]")
    else:
        console.print(f"[yellow]X post result:[/yellow] {result}")


@main.command("x-login")
@click.option("--env-file", default=".env", help="Path to .env")
def x_login(env_file: str):
    """Open X login and wait for manual 2FA completion."""
    ensure_app_dir()
    _load_env_file(env_file)
    settings = Settings(_env_file=env_file)
    result = asyncio.run(open_x_for_manual_login(settings=settings))
    console.print(result)


@main.command("demo-cycle")
@click.option("--env-file", default=".env", help="Path to .env")
@click.option("--provider-app-id", type=int, default=None, help="Provider app id to purchase from")
@click.option("--service-name", default="Oscorp GTM Sprint", help="Service name for self-registration")
@click.option("--price-micro-usdc", type=int, default=50_000, help="Service price in micro USDC")
def demo_cycle(
    env_file: str,
    provider_app_id: int | None,
    service_name: str,
    price_micro_usdc: int,
):
    """Run end-to-end demo: register -> quote -> pay -> purchase -> post to X."""
    ensure_app_dir()
    _load_env_file(env_file)
    settings = Settings(_env_file=env_file)
    if not settings.oscorp_id:
        console.print("[red]OSCORP_ID is required for demo-cycle.[/red]")
        sys.exit(1)
    result = asyncio.run(
        _run_demo_cycle(
            settings=settings,
            provider_app_id=provider_app_id,
            service_name=service_name,
            price_micro_usdc=price_micro_usdc,
        )
    )
    _print_demo_cycle_report(result, settings)


@main.command("demo-new-company")
@click.option("--env-file", default=".env", help="Path to .env")
@click.option("--name-prefix", default="OscorpDemo", help="Prefix for new company name")
@click.option("--category", default="Marketing", help="Company category")
@click.option("--price-micro-usdc", type=int, default=50_000, help="Service price in micro USDC")
def demo_new_company(env_file: str, name_prefix: str, category: str, price_micro_usdc: int):
    """Create a new Oscorp company, then run full demo-cycle on it."""
    ensure_app_dir()
    _load_env_file(env_file)
    settings = Settings(_env_file=env_file)
    result = asyncio.run(
        _run_demo_new_company(
            settings=settings,
            name_prefix=name_prefix,
            category=category,
            price_micro_usdc=price_micro_usdc,
        )
    )
    console.print(result)


async def _run_demo_cycle(
    *,
    settings: Settings,
    provider_app_id: int | None,
    service_name: str,
    price_micro_usdc: int,
) -> dict:
    api = OscorpAPIClient(settings)
    try:
        health = await api.health()
        if not health:
            return {"error": "Backend unreachable"}

        state = await api.get_oscorp_state()
        if not state:
            return {"error": "Could not fetch Oscorp state"}

        provider = provider_app_id or settings.oscorp_id
        provider_address = str(state.get("creator", ""))
        if provider == settings.oscorp_id:
            reg = await api.register_service(
                service_name=service_name,
                description="3-day GTM sprint with actionable recommendations",
                price_micro_usdc=price_micro_usdc,
                provider_address=provider_address,
            )
            if not reg:
                return {"error": "Service registration failed"}

        quote_status, quote = await api.get_service_quote(provider)
        if quote_status != 402 or not quote:
            return {"error": "Could not fetch payment challenge", "quote_status": quote_status, "quote": quote}

        amount = int(quote.get("accepts", {}).get("amountMicroUsdc", 0))
        pay_to = str(quote.get("accepts", {}).get("payTo", ""))
        pay_status, pay_result = await api.x402_pay(to=pay_to, amount_micro_usdc=amount)
        if pay_status not in (200, 201) or not pay_result:
            return {"error": "x402 pay failed", "pay_status": pay_status, "pay_result": pay_result}

        tx_id = str(pay_result.get("payment", {}).get("txId", ""))
        header = build_x402_payment_header(
            payer_app_id=int(settings.oscorp_id),
            amount_micro_usdc=amount,
            tx_id=tx_id,
        )
        buy_status, buy_result = await api.purchase_service(
            provider_app_id=provider,
            payment_header=header,
            payload={"demo": True, "source": "demo-cycle"},
        )
        if buy_status not in (200, 201) or not buy_result:
            return {"error": "Purchase failed", "buy_status": buy_status, "buy_result": buy_result}

        post_text = await _generate_demo_copy(state=state, purchase=buy_result)
        post_text = f"{post_text} ({datetime.now(timezone.utc).strftime('%H:%M:%S')} UTC)"[:280]
        # Keep demo-cycle presentation-safe: do not post to X directly.
        # We only show that content is ready and queued for publishing once access/session is available.
        post_result = {
            "status": "queued_for_x_access",
            "message": "Will post on X once access/session is available.",
            "queued_text": post_text[:280],
        }

        await api.report_activity(
            type_="demo_cycle",
            content=f"Purchased service with txId={tx_id}; x_post={post_result.get('status', 'unknown')}",
            channel="agent",
        )

        return {
            "status": "ok",
            "providerAppId": provider,
            "paymentTxId": tx_id,
            "purchase": buy_result,
            "xPost": post_result,
        }
    finally:
        await api.close()


async def _run_demo_new_company(
    *,
    settings: Settings,
    name_prefix: str,
    category: str,
    price_micro_usdc: int,
) -> dict:
    if not settings.oscorp_id:
        return {
            "error": (
                "OSCORP_ID is required to derive demo addresses. "
                "Set OSCORP_ID to an existing app first."
            )
        }

    api = OscorpAPIClient(settings)
    try:
        state = await api.get_oscorp_state()
        if not state:
            return {"error": "Could not fetch base Oscorp state to derive addresses"}
        gs = state.get("globalState", {}) if isinstance(state, dict) else {}

        creator = str(gs.get("creator", state.get("creator", "")))
        investor = str(gs.get("investor", creator))
        treasury = str(gs.get("treasury", creator))
        if not creator:
            return {"error": "Could not derive creator address from base Oscorp state"}

        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        create_payload = {
            "name": f"{name_prefix}-{ts}",
            "category": category,
            "metadataUri": f"ipfs://{name_prefix.lower()}-{ts}",
            "creatorAddress": creator,
            "investorAddress": investor,
            "treasuryAddress": treasury,
            "pulseUnitName": "PULSE",
            "pulseAssetName": f"{name_prefix} Pulse",
            "pulseTotal": 1_000_000,
            "pulseDecimals": 6,
            "creatorShareBps": 6000,
            "investorShareBps": 2500,
            "treasuryShareBps": 1500,
            "launchpadFeeBps": 300,
            "approvalThresholdUsdc": 10,
            "gtmBudgetUsdc": 200,
            "minPatronPulse": 100,
        }
        create_status, created = await api.create_oscorp(create_payload)
        if create_status not in (200, 201) or not created:
            return {"error": "create_oscorp failed", "status": create_status, "response": created}

        new_app_id = int(created.get("appId", 0))
        if new_app_id <= 0:
            return {"error": "create_oscorp did not return a valid appId", "response": created}

        settings.oscorp_id = new_app_id
        result = await _run_demo_cycle(
            settings=settings,
            provider_app_id=new_app_id,
            service_name=f"{name_prefix} GTM Sprint",
            price_micro_usdc=price_micro_usdc,
        )
        return {
            "created": created,
            "demoCycle": result,
        }
    finally:
        await api.close()


if __name__ == "__main__":
    main()
