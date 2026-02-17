import logging
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Callable

import pytest
from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

TARGET_RELATION = "D.I.A.S."


def _run_dir() -> Path:
    path = Path(os.getenv("TOOLBOX_RUN_DIR", "runs/local-run"))
    path.mkdir(parents=True, exist_ok=True)
    (path / "screenshots").mkdir(parents=True, exist_ok=True)
    (path / "videos").mkdir(parents=True, exist_ok=True)
    return path


def _get_logger() -> logging.Logger:
    logger = logging.getLogger("toolbox.playwright")
    logger.setLevel(logging.INFO)

    if logger.handlers:
        return logger

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(stream_handler)

    log_file = _run_dir() / "logs.txt"
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(file_handler)

    return logger


def _step(message: str) -> None:
    _get_logger().info("STEP: %s", message)


def _candidate_locators(page: Page, pattern: str) -> list[Locator]:
    regex = re.compile(pattern, re.IGNORECASE)
    return [
        page.get_by_role("button", name=regex).first,
        page.get_by_role("link", name=regex).first,
        page.get_by_text(regex).first,
        page.locator(f"[data-testid*='{pattern}' i]").first,
    ]


def _first_visible(page: Page, factories: list[Callable[[Page], Locator]], timeout_ms: int = 15000) -> Locator:
    last_error: Exception | None = None
    for factory in factories:
        locator = factory(page).first
        try:
            locator.wait_for(state="visible", timeout=timeout_ms)
            return locator
        except Exception as exc:  # pragma: no cover - fallback scanning
            last_error = exc
    raise AssertionError(f"Geen bruikbare selector gevonden: {last_error}")


def _click_by_text(page: Page, label: str, timeout_ms: int = 20000) -> None:
    _step(f"click {label}")
    pattern = re.escape(label)
    locator = _first_visible(
        page,
        [
            lambda p: p.get_by_role("button", name=re.compile(pattern, re.IGNORECASE)),
            lambda p: p.get_by_role("link", name=re.compile(pattern, re.IGNORECASE)),
            lambda p: p.get_by_text(re.compile(pattern, re.IGNORECASE)),
            lambda p: p.locator(f"[data-testid*='{label}' i]"),
        ],
        timeout_ms=timeout_ms,
    )
    locator.click()


def _detect_login_screen(page: Page) -> bool:
    password = page.locator("input[type='password']").first
    if password.is_visible(timeout=1000):
        return True

    for pattern in [r"inloggen", r"aanmelden", r"login", r"sign in"]:
        if page.get_by_text(re.compile(pattern, re.IGNORECASE)).first.is_visible(timeout=500):
            return True

    return False


def _attempt_login_if_needed(page: Page) -> None:
    if not _detect_login_screen(page):
        return

    _step("login scherm gedetecteerd")
    username = os.getenv("TOOLBOX_TEST_USERNAME")
    password = os.getenv("TOOLBOX_TEST_PASSWORD")

    if not username or not password:
        raise AssertionError("Not logged in and no credentials provided")

    username_input = _first_visible(
        page,
        [
            lambda p: p.get_by_label(re.compile(r"gebruikersnaam|e-mail|email|user", re.IGNORECASE)),
            lambda p: p.locator("input[type='email']"),
            lambda p: p.locator("input[name*='user' i]"),
            lambda p: p.locator("input[type='text']"),
        ],
        timeout_ms=10000,
    )
    username_input.fill(username)

    password_input = _first_visible(
        page,
        [
            lambda p: p.get_by_label(re.compile(r"wachtwoord|password", re.IGNORECASE)),
            lambda p: p.locator("input[type='password']"),
        ],
        timeout_ms=10000,
    )
    password_input.fill(password)

    submit = _first_visible(
        page,
        [
            lambda p: p.get_by_role("button", name=re.compile(r"inloggen|aanmelden|login|sign in", re.IGNORECASE)),
            lambda p: p.locator("button[type='submit']"),
            lambda p: p.locator("input[type='submit']"),
        ],
        timeout_ms=10000,
    )
    _step("probeer in te loggen met env credentials")
    submit.click()
    page.wait_for_load_state("networkidle", timeout=30000)

    if _detect_login_screen(page):
        raise AssertionError("Login failed using TOOLBOX_TEST_USERNAME/TOOLBOX_TEST_PASSWORD")


def _set_date_to_today(page: Page) -> None:
    _step("set Gewenste ingangsdatum op vandaag")
    today_button = page.get_by_role("button", name=re.compile(r"today|vandaag", re.IGNORECASE)).first
    if today_button.is_visible(timeout=1000):
        today_button.click()
        return

    input_locator = _first_visible(
        page,
        [
            lambda p: p.get_by_label(re.compile(r"gewenste ingangsdatum", re.IGNORECASE)),
            lambda p: p.locator("input[name*='ingangsdatum' i]"),
            lambda p: p.locator("input[placeholder*='datum' i]"),
            lambda p: p.locator("input[type='date']"),
        ],
        timeout_ms=15000,
    )

    today = datetime.today()
    formats = [today.strftime("%d-%m-%Y"), today.strftime("%d/%m/%Y"), today.strftime("%Y-%m-%d")]
    for value in formats:
        input_locator.fill(value)
        current = input_locator.input_value()
        if current:
            break


def _set_select_value(page: Page, field_pattern: str, option_pattern: str) -> None:
    field_regex = re.compile(field_pattern, re.IGNORECASE)
    option_regex = re.compile(option_pattern, re.IGNORECASE)

    _step(f"set {field_pattern} -> {option_pattern}")
    field = _first_visible(
        page,
        [
            lambda p: p.get_by_label(field_regex),
            lambda p: p.get_by_role("combobox", name=field_regex),
            lambda p: p.locator(f"[data-testid*='{field_pattern}' i]"),
            lambda p: p.get_by_text(field_regex),
        ],
        timeout_ms=20000,
    )

    tag_name = ""
    try:
        tag_name = field.evaluate("el => el.tagName.toLowerCase()")
    except Exception:
        tag_name = ""

    if tag_name == "select":
        field.select_option(label=option_regex)
        return

    field.click()
    option = _first_visible(
        page,
        [
            lambda p: p.get_by_role("option", name=option_regex),
            lambda p: p.get_by_role("listitem", name=option_regex),
            lambda p: p.get_by_text(option_regex),
        ],
        timeout_ms=15000,
    )
    option.click()


def _assert_premium_bottom_left(page: Page, timeout_seconds: int = 30) -> None:
    _step("validate premie linksonder")
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        visible = page.evaluate(
            """() => {
                const width = window.innerWidth || 0;
                const height = window.innerHeight || 0;
                const nodes = Array.from(document.querySelectorAll('body *'));
                const candidates = nodes.filter((el) => {
                    const text = (el.textContent || '').trim();
                    if (!text) return false;
                    if (!/(\\u20ac\s*[\d.,]+|premie)/i.test(text)) return false;
                    const rect = el.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0) return false;
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) {
                        return false;
                    }
                    return rect.left <= width * 0.6 && rect.top >= height * 0.45;
                });

                if (!candidates.length) return false;
                return candidates.some((el) => /\\u20ac\s*[\d.,]+/i.test((el.textContent || '').trim()));
            }"""
        )
        if visible:
            return

        page.wait_for_timeout(1000)

    screenshot_path = _run_dir() / "screenshots" / "premie-timeout.png"
    page.screenshot(path=str(screenshot_path), full_page=True)
    raise AssertionError("Premie niet zichtbaar linksonder binnen 30 seconden")


@pytest.fixture
def run_dir() -> Path:
    return _run_dir()


@pytest.fixture
def page(run_dir: Path) -> Page:
    headless = os.getenv("TOOLBOX_TEST_HEADLESS", "1") != "0"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=headless)
        context = browser.new_context(
            ignore_https_errors=True,
            record_video_dir=str(run_dir / "videos"),
        )
        context.tracing.start(screenshots=True, snapshots=True, sources=True)
        active_page = context.new_page()

        try:
            yield active_page
        finally:
            trace_path = run_dir / "trace.zip"
            try:
                context.tracing.stop(path=str(trace_path))
            except Exception:
                pass
            context.close()
            browser.close()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when != "call" or report.passed:
        return

    active_page = item.funcargs.get("page")
    run_dir = item.funcargs.get("run_dir")
    if not active_page or not run_dir:
        return

    screenshot = Path(run_dir) / "screenshots" / f"{item.name}-failure.png"
    try:
        active_page.screenshot(path=str(screenshot), full_page=True)
    except Exception:
        pass


@pytest.mark.avp_scenario
@pytest.mark.smoke
def test_avp_scenario(page: Page):
    base_url = os.getenv("TOOLBOX_TEST_BASE_URL", "https://adviseuracceptatie.private-insurance.eu/#/dashboard")

    _step(f"open pagina {base_url}")
    page.goto(base_url, wait_until="domcontentloaded", timeout=60000)
    _attempt_login_if_needed(page)

    _click_by_text(page, "Uitgebreid zoeken")

    _step("zoek op veld Volledige naam bevat met waarde D.I.A.S.")
    name_field = _first_visible(
        page,
        [
            lambda p: p.get_by_label(re.compile(r"Volledige naam bevat", re.IGNORECASE)),
            lambda p: p.get_by_placeholder(re.compile(r"Volledige naam bevat", re.IGNORECASE)),
            lambda p: p.locator("input[name*='volledige' i][name*='naam' i]"),
            lambda p: p.locator("[data-testid*='volledige-naam' i] input"),
            lambda p: p.locator("input[type='text']"),
        ],
        timeout_ms=20000,
    )
    name_field.fill(TARGET_RELATION)
    name_field.press("Enter")

    search_button = page.get_by_role("button", name=re.compile(r"zoek|search", re.IGNORECASE)).first
    if search_button.is_visible(timeout=1000):
        _step("trigger zoeken via zoekknop")
        search_button.click()

    _step("klik gevonden relatie D.I.A.S.")
    relation = _first_visible(
        page,
        [
            lambda p: p.get_by_role("row", name=re.compile(r"D\.?I\.?A\.?S\.?", re.IGNORECASE)),
            lambda p: p.get_by_role("link", name=re.compile(r"D\.?I\.?A\.?S\.?", re.IGNORECASE)),
            lambda p: p.get_by_text(re.compile(r"D\.?I\.?A\.?S\.?", re.IGNORECASE)),
            lambda p: p.locator("[data-testid*='relatie' i]", has_text=re.compile(r"D\.?I\.?A\.?S\.?", re.IGNORECASE)),
        ],
        timeout_ms=30000,
    )
    relation.click()

    _click_by_text(page, "Scenario starten")
    _click_by_text(page, "Product toevoegen")
    _click_by_text(page, "Aansprakelijkheid")
    _click_by_text(page, "Liberty AVP NL")
    _click_by_text(page, "Product aanvragen")

    _set_date_to_today(page)
    _set_select_value(page, r"Betaaltermijn", r"per\s+jaar|jaar")

    _click_by_text(page, "Volgende")

    _set_select_value(page, r"Type gebeurtenis", r"Nieuwe aanvraag")
    _set_select_value(page, r"Gezinssamenstelling", r"gezin met kinderen")
    _set_select_value(
        page,
        r"Verzekerde som",
        r"(5[\.,\s]?0{3}[\.,\s]?0{3}|5000000).*(gebeurtenis)?",
    )

    _assert_premium_bottom_left(page, timeout_seconds=30)

