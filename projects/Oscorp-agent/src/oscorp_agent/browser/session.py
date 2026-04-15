from __future__ import annotations

import asyncio
from pathlib import Path

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

from oscorp_agent.config import APP_DIR, Settings


def _profile_dir() -> Path:
    settings = Settings()
    if settings.browser_profile_dir:
        profile = Path(settings.browser_profile_dir).expanduser()
    else:
        profile = APP_DIR / "chrome-profile"
    profile.mkdir(parents=True, exist_ok=True)
    return profile


async def _fill_first_visible(page, selectors: list[str], value: str, timeout_ms: int = 20000) -> bool:
    for sel in selectors:
        locator = page.locator(sel).first
        try:
            await locator.wait_for(state="visible", timeout=timeout_ms)
            await locator.fill(value)
            return True
        except Exception:
            continue
    return False


async def _click_first_visible(page, selectors: list[str], timeout_ms: int = 15000) -> bool:
    for sel in selectors:
        locator = page.locator(sel).first
        try:
            await locator.wait_for(state="visible", timeout=timeout_ms)
            await locator.click()
            return True
        except Exception:
            continue
    return False


async def post_to_x_via_browser(*, settings: Settings, content: str) -> dict:
    if not settings.x_username or not settings.x_password:
        return {"error": "X_USERNAME and X_PASSWORD are required for browser mode"}
    if len(content) > 280:
        return {"error": f"Post is {len(content)} chars; X limit is 280"}

    async with async_playwright() as p:
        browser = None
        context = None
        if settings.browser_cdp_url:
            browser = await p.chromium.connect_over_cdp(settings.browser_cdp_url)
            if not browser.contexts:
                return {
                    "error": (
                        "Attached browser has no contexts. Open a normal Brave window/tab first, "
                        "then retry."
                    )
                }
            context = browser.contexts[0]
        else:
            launch_kwargs = {
                "user_data_dir": str(_profile_dir()),
                "headless": settings.browser_headless,
                "args": [
                    "--disable-features=PasswordManager,PasswordManagerOnboarding",
                    "--disable-save-password-bubble",
                    "--disable-session-crashed-bubble",
                    "--hide-crash-restore-bubble",
                ],
            }
            if settings.browser_executable_path:
                launch_kwargs["executable_path"] = settings.browser_executable_path
            else:
                launch_kwargs["channel"] = settings.browser_channel or None
            context = await p.chromium.launch_persistent_context(**launch_kwargs)
        page = context.pages[0] if context.pages else await context.new_page()

        try:
            await page.goto("https://x.com/home", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)

            logged_in = await page.locator("[data-testid='SideNav_NewTweet_Button']").count() > 0
            if not logged_in and settings.x_auto_login:
                await page.goto("https://x.com/i/flow/login", wait_until="domcontentloaded", timeout=30000)
                username_ok = await _fill_first_visible(
                    page,
                    [
                        "input[autocomplete='username']",
                        "input[name='text']",
                        "input",
                    ],
                    settings.x_username,
                )
                if not username_ok:
                    return {"error": "Could not find X username input field"}
                next_ok = await _click_first_visible(
                    page,
                    [
                        "button:has-text('Next')",
                        "div[role='button']:has-text('Next')",
                    ],
                )
                if not next_ok:
                    return {"error": "Could not click X Next button"}
                await asyncio.sleep(2)

                if settings.x_email:
                    email_ok = await _fill_first_visible(
                        page,
                        [
                            "input[data-testid='ocfEnterTextTextInput']",
                            "input[name='text']",
                        ],
                        settings.x_email,
                        timeout_ms=5000,
                    )
                    if email_ok:
                        await _click_first_visible(
                            page,
                            [
                                "button:has-text('Next')",
                                "div[role='button']:has-text('Next')",
                            ],
                            timeout_ms=8000,
                        )
                        await asyncio.sleep(2)

                password_ok = await _fill_first_visible(
                    page,
                    [
                        "input[name='password']",
                        "input[type='password']",
                    ],
                    settings.x_password,
                )
                if not password_ok:
                    return {"error": "Could not find X password field"}
                login_ok = await _click_first_visible(
                    page,
                    [
                        "button:has-text('Log in')",
                        "div[role='button']:has-text('Log in')",
                    ],
                )
                if not login_ok:
                    return {"error": "Could not click X Log in button"}
                await page.wait_for_timeout(4000)
                logged_in = await page.locator("[data-testid='SideNav_NewTweet_Button']").count() > 0

            if not logged_in and not settings.x_auto_login:
                return {
                    "error": (
                        "X session is not logged in for this profile. "
                        "Run `python3 -m oscorp_agent x-login` once. "
                        "Set X_AUTO_LOGIN=true only if you want automatic login attempts."
                    )
                }

            compose_clicked = await _click_first_visible(
                page,
                [
                    "[data-testid='SideNav_NewTweet_Button']",
                    "a[aria-label='Post']",
                ],
                timeout_ms=5000,
            )
            if not compose_clicked:
                await page.keyboard.press("n")
                await page.wait_for_timeout(1500)

            text_ok = await _fill_first_visible(
                page,
                [
                    "[data-testid='tweetTextarea_0']",
                    "div[role='textbox'][data-testid='tweetTextarea_0']",
                    "div[role='textbox']",
                ],
                content,
                timeout_ms=10000,
            )
            if not text_ok:
                await page.keyboard.type(content, delay=20)
            await page.wait_for_timeout(800)
            posted = await _click_first_visible(
                page,
                [
                    "[data-testid='tweetButtonInline']",
                    "[data-testid='tweetButton']",
                    "div[role='button']:has-text('Post')",
                ],
                timeout_ms=5000,
            )
            if not posted:
                await page.keyboard.press("Control+Enter")
            await page.wait_for_timeout(3000)
            return {"status": "posted", "channel": "X", "content": content}
        except PlaywrightTimeoutError as exc:
            return {"error": f"Browser timeout while posting: {exc}"}
        except Exception as exc:
            return {"error": f"Browser posting failed: {type(exc).__name__}: {exc}"}
        finally:
            if settings.browser_cdp_url:
                if browser is not None:
                    await browser.close()
            else:
                await context.close()


async def open_x_for_manual_login(*, settings: Settings) -> dict:
    async with async_playwright() as p:
        browser = None
        context = None
        if settings.browser_cdp_url:
            browser = await p.chromium.connect_over_cdp(settings.browser_cdp_url)
            if not browser.contexts:
                return {
                    "error": (
                        "Attached browser has no contexts. Open a normal Brave window/tab first, "
                        "then run x-login again."
                    )
                }
            context = browser.contexts[0]
        else:
            launch_kwargs = {
                "user_data_dir": str(_profile_dir()),
                "headless": False,
            }
            if settings.browser_executable_path:
                launch_kwargs["executable_path"] = settings.browser_executable_path
            else:
                launch_kwargs["channel"] = settings.browser_channel or None
            context = await p.chromium.launch_persistent_context(**launch_kwargs)
        page = context.pages[0] if context.pages else await context.new_page()
        try:
            await page.goto("https://x.com/i/flow/login", wait_until="domcontentloaded", timeout=30000)
            print("\nComplete login + 2FA in the opened browser, then press ENTER here.")
            await asyncio.to_thread(input)
            return {"status": "ready", "message": "Manual login captured in persistent profile."}
        finally:
            if settings.browser_cdp_url:
                if browser is not None:
                    await browser.close()
            else:
                await context.close()


async def check_x_session(*, settings: Settings) -> dict:
    async with async_playwright() as p:
        browser = None
        context = None
        try:
            if settings.browser_cdp_url:
                browser = await p.chromium.connect_over_cdp(settings.browser_cdp_url)
                if not browser.contexts:
                    return {"logged_in": False, "error": "No browser contexts found on CDP session"}
                context = browser.contexts[0]
            else:
                launch_kwargs = {
                    "user_data_dir": str(_profile_dir()),
                    "headless": settings.browser_headless,
                }
                if settings.browser_executable_path:
                    launch_kwargs["executable_path"] = settings.browser_executable_path
                else:
                    launch_kwargs["channel"] = settings.browser_channel or None
                context = await p.chromium.launch_persistent_context(**launch_kwargs)

            page = context.pages[0] if context.pages else await context.new_page()
            await page.goto("https://x.com/home", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(1)
            logged_in = await page.locator("[data-testid='SideNav_NewTweet_Button']").count() > 0
            return {"logged_in": logged_in}
        finally:
            if settings.browser_cdp_url:
                if browser is not None:
                    await browser.close()
            else:
                if context is not None:
                    await context.close()
