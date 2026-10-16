"""Optional LinkedIn profile import (Tasks 1.6.1, 1.6.7, 1.6.8).

A headless Chromium session logs in with the student's own credentials,
which arrive per request from the Next.js app (stored encrypted there) and
live only in this thread's memory. Never written to disk, never logged.

Account protection:
  * one login attempt per session; the caller enforces 1 attempt / 24 h and
    the 14-day cooldown per account;
  * an SMS/email verification code pauses the session for up to 60 s while
    the student types the code into the app's relay modal;
  * a CAPTCHA, an account restriction, or wrong credentials abort at once,
    with no retry.

State crosses uvicorn workers through small JSON files in the private data
dir (the OTP POST may reach a different worker than the one holding the
browser). Files hold state, the relayed one-time code, and nothing else.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import shutil
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import UserContext, get_current_user
from .config import settings

router = APIRouter(prefix="/api/linkedin", tags=["linkedin"])

OTP_WINDOW_SECONDS = int(os.environ.get("LINKEDIN_OTP_WINDOW_SECONDS", "60"))  # 60 s in production; shorter only in tests
LOGIN_WAIT_SECONDS = 25
BASE_URL = os.environ.get("LINKEDIN_BASE_URL", "https://www.linkedin.com").rstrip("/")
SESSION_DIR = Path(settings.storage_dir) / "linkedin"

State = Literal["starting", "challenge_required", "verifying", "scraping", "succeeded", "failed", "captcha", "restricted", "bad_credentials", "timed_out", "cancelled"]
TERMINAL = {"succeeded", "failed", "captcha", "restricted", "bad_credentials", "timed_out", "cancelled"}


def _path(session_id: str, suffix: str = "json") -> Path:
    if not re.fullmatch(r"li_[A-Za-z0-9_-]{16,64}", session_id):
        raise HTTPException(404, "Session not found")
    return SESSION_DIR / f"{session_id}.{suffix}"


def _read(session_id: str) -> dict | None:
    p = _path(session_id)
    try:
        return json.loads(p.read_text("utf-8"))
    except FileNotFoundError:
        return None


def _write(session_id: str, **changes) -> dict:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    state = {**(_read(session_id) or {}), **changes, "updated_at": time.time()}
    tmp = _path(session_id, "tmp")
    tmp.write_text(json.dumps(state), "utf-8")
    os.replace(tmp, _path(session_id))
    return state


def _owned(session_id: str, user: UserContext) -> dict:
    state = _read(session_id)
    if not state or state.get("owner_id") != user.user_id:
        raise HTTPException(404, "Session not found")
    return state


# ── browser ───────────────────────────────────────────────────────────────

def _driver(profile_dir: Path):
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    opts = Options()
    for arg in ("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--window-size=1280,1600",
                f"--user-data-dir={profile_dir}"):
        opts.add_argument(arg)
    binary = os.environ.get("CHROME_BIN")
    if binary:
        opts.binary_location = binary
    return webdriver.Chrome(options=opts)


def _classify(driver) -> str | None:
    """What the page is now: 'ok', 'otp', 'captcha', 'restricted', 'bad_credentials', or None (still loading)."""
    from selenium.webdriver.common.by import By

    url = driver.current_url.lower()
    if "/feed" in url or "/in/" in url:
        return "ok"
    html = driver.page_source.lower()
    if "captcha" in html or "arkoselabs" in html or driver.find_elements(By.CSS_SELECTOR, "iframe[src*='captcha'], #captcha-internal"):
        return "captcha"
    if "/checkpoint/restricted" in url or "account restricted" in html or "temporarily restricted" in html:
        return "restricted"
    if driver.find_elements(By.CSS_SELECTOR, "input[name='pin'], #input__email_verification_pin, #input__phone_verification_pin"):
        return "otp"
    if driver.find_elements(By.CSS_SELECTOR, "#error-for-password, #error-for-username"):
        return "bad_credentials"
    return None


def _wait_for(driver, seconds: float, want: set[str]) -> str | None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        kind = _classify(driver)
        if kind in want:
            return kind
        time.sleep(0.4)
    return None


def _text(el, css: str) -> str:
    from selenium.webdriver.common.by import By

    found = el.find_elements(By.CSS_SELECTOR, css)
    return found[0].text.strip() if found else ""


def _scrape_profile(driver) -> dict:
    """Own profile. Uses joeyism/linkedin_scraper against real LinkedIn; a
    simple data-attribute parser when LINKEDIN_PARSER=simple (test pages)."""
    driver.get(f"{BASE_URL}/in/me/")
    time.sleep(1.0)
    if os.environ.get("LINKEDIN_PARSER") == "simple":
        from selenium.webdriver.common.by import By

        return {
            "name": _text(driver, "[data-li='name']"),
            "headline": _text(driver, "[data-li='headline']"),
            "location": _text(driver, "[data-li='location']"),
            "experiences": [
                {"title": _text(e, "[data-li='title']"), "company": _text(e, "[data-li='company']"),
                 "from_date": _text(e, "[data-li='from']"), "to_date": _text(e, "[data-li='to']"), "description": _text(e, "[data-li='description']")}
                for e in driver.find_elements(By.CSS_SELECTOR, "[data-li='experience']")
            ],
            "educations": [
                {"institution": _text(e, "[data-li='institution']"), "degree": _text(e, "[data-li='degree']"),
                 "from_date": _text(e, "[data-li='from']"), "to_date": _text(e, "[data-li='to']")}
                for e in driver.find_elements(By.CSS_SELECTOR, "[data-li='education']")
            ],
            "profile_url": driver.current_url,
        }
    from linkedin_scraper import Person  # joeyism/linkedin_scraper

    person = Person(driver.current_url, driver=driver, scrape=True, close_on_complete=False)
    return {
        "name": person.name or "",
        "headline": getattr(person, "job_title", "") or "",
        "location": getattr(person, "location", "") or "",
        "experiences": [
            {"title": x.position_title or "", "company": x.institution_name or "", "from_date": x.from_date or "", "to_date": x.to_date or "", "description": x.description or ""}
            for x in (person.experiences or [])
        ],
        "educations": [
            {"institution": x.institution_name or "", "degree": x.degree or "", "from_date": x.from_date or "", "to_date": x.to_date or ""}
            for x in (person.educations or [])
        ],
        "profile_url": driver.current_url,
    }


@dataclass
class _Run:
    session_id: str
    email: str
    password: str = field(repr=False)


def _run(job: _Run) -> None:
    sid = job.session_id
    profile_dir = SESSION_DIR / f"{sid}.profile"
    driver = None
    try:
        from selenium.webdriver.common.by import By

        driver = _driver(profile_dir)
        driver.get(f"{BASE_URL}/login")
        driver.find_element(By.ID, "username").send_keys(job.email)
        driver.find_element(By.ID, "password").send_keys(job.password)
        job.password = ""  # drop our reference as soon as it has been typed
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

        kind = _wait_for(driver, LOGIN_WAIT_SECONDS, {"ok", "otp", "captcha", "restricted", "bad_credentials"})
        if kind == "otp":
            expires = time.time() + OTP_WINDOW_SECONDS
            _write(sid, state="challenge_required", challenge_expires_at=expires)
            code = None
            otp_file = _path(sid, "otp")
            while time.time() < expires:
                current = _read(sid)
                if not current or current.get("state") == "cancelled":  # skipped, or purged by disconnect
                    return
                if otp_file.exists():
                    code = otp_file.read_text("utf-8").strip()
                    otp_file.unlink(missing_ok=True)
                    break
                time.sleep(0.5)
            if not code:
                _write(sid, state="timed_out", error=f"No verification code was entered within {OTP_WINDOW_SECONDS} seconds.")
                return
            _write(sid, state="verifying")
            pin = driver.find_element(By.CSS_SELECTOR, "input[name='pin'], #input__email_verification_pin, #input__phone_verification_pin")
            pin.clear()
            pin.send_keys(code)
            driver.find_element(By.CSS_SELECTOR, "#email-pin-submit-button, #two-step-submit-button, button[type='submit']").click()
            kind = _wait_for(driver, LOGIN_WAIT_SECONDS, {"ok", "otp", "captcha", "restricted"})
            if kind == "otp":
                _write(sid, state="failed", error="LinkedIn did not accept that code.")
                return

        if kind in ("captcha", "restricted", "bad_credentials"):
            messages = {
                "captcha": "LinkedIn asked for a CAPTCHA. We stopped immediately so your account stays safe.",
                "restricted": "LinkedIn has placed a temporary hold on this account. We stopped and won't retry.",
                "bad_credentials": "LinkedIn didn't accept that email and password.",
            }
            _write(sid, state=kind, error=messages[kind])
            return
        if kind != "ok":
            _write(sid, state="failed", error="LinkedIn didn't finish signing in.")
            return

        _write(sid, state="scraping")
        _write(sid, state="succeeded", profile=_scrape_profile(driver))
    except Exception as exc:  # noqa: BLE001 - surface any browser failure as a terminal state
        _write(sid, state="failed", error=f"LinkedIn import failed: {type(exc).__name__}")
    finally:
        job.password = ""
        if driver is not None:
            try:
                driver.quit()
            except Exception:  # noqa: BLE001
                pass
        # No cookies or browser profile survive a run.
        shutil.rmtree(profile_dir, ignore_errors=True)


# ── API ───────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200, repr=False)
    correlation_id: str | None = Field(default=None, max_length=80)


class OtpRequest(BaseModel):
    code: str = Field(pattern=r"^\d{4,8}$")


def _public(sid: str, state: dict) -> dict:
    return {
        "session_id": sid,
        "state": state.get("state"),
        "error": state.get("error"),
        "challenge_seconds_left": max(0, int(state["challenge_expires_at"] - time.time())) if state.get("state") == "challenge_required" else None,
        "profile": state.get("profile") if state.get("state") == "succeeded" else None,
    }


@router.post("/sessions", status_code=202)
def start(body: StartRequest, user: Annotated[UserContext, Depends(get_current_user)]):
    sid = f"li_{secrets.token_urlsafe(18)}"
    _write(sid, state="starting", owner_id=user.user_id, correlation_id=body.correlation_id, created_at=time.time())
    threading.Thread(target=_run, args=(_Run(sid, body.email, body.password),), daemon=True).start()
    return _public(sid, _read(sid) or {})


@router.get("/sessions/{session_id}")
def status(session_id: str, user: Annotated[UserContext, Depends(get_current_user)]):
    return _public(session_id, _owned(session_id, user))


@router.post("/sessions/{session_id}/otp")
def otp(session_id: str, body: OtpRequest, user: Annotated[UserContext, Depends(get_current_user)]):
    state = _owned(session_id, user)
    if state.get("state") != "challenge_required" or time.time() > state.get("challenge_expires_at", 0):
        raise HTTPException(409, "This verification window has closed.")
    _path(session_id, "otp").write_text(body.code, "utf-8")
    return {"accepted": True}


@router.delete("/sessions/{session_id}", status_code=204)
def cancel(session_id: str, user: Annotated[UserContext, Depends(get_current_user)]):
    """Cancel / skip: stops a waiting session and deletes its state (1.6.7, 1.6.8)."""
    state = _owned(session_id, user)
    if state.get("state") not in TERMINAL:
        _write(session_id, state="cancelled")
    shutil.rmtree(SESSION_DIR / f"{session_id}.profile", ignore_errors=True)
    for suffix in ("otp",):
        _path(session_id, suffix).unlink(missing_ok=True)


@router.delete("/accounts/me", status_code=204)
def invalidate_all(user: Annotated[UserContext, Depends(get_current_user)]):
    """Disconnect (1.6.7): end every session of this user and delete their state, profiles and pending codes."""
    if not SESSION_DIR.exists():
        return
    for p in SESSION_DIR.glob("li_*.json"):
        try:
            state = json.loads(p.read_text("utf-8"))
        except Exception:  # noqa: BLE001
            continue
        if state.get("owner_id") != user.user_id:
            continue
        sid = p.stem
        if state.get("state") not in TERMINAL:
            _write(sid, state="cancelled")
        shutil.rmtree(SESSION_DIR / f"{sid}.profile", ignore_errors=True)
        _path(sid, "otp").unlink(missing_ok=True)
        p.unlink(missing_ok=True)
