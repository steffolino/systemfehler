import json
import os
import urllib.parse
import urllib.request

TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "")
TURNSTILE_VERIFY_URL = os.environ.get(
    "TURNSTILE_VERIFY_URL",
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
)


def is_turnstile_configured() -> bool:
    return bool(TURNSTILE_SECRET_KEY)


def verify_turnstile_token(token: str | None, remote_ip: str | None = None) -> dict:
    if not is_turnstile_configured():
        return {"success": True, "skipped": True, "error_codes": []}

    if not token:
        return {
            "success": False,
            "skipped": False,
            "error_codes": ["missing-input-response"],
        }

    payload = {
        "secret": TURNSTILE_SECRET_KEY,
        "response": token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    request = urllib.request.Request(
        TURNSTILE_VERIFY_URL,
        data=urllib.parse.urlencode(payload).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=15) as response:
        body = json.loads(response.read().decode("utf-8"))

    return {
        "success": bool(body.get("success")),
        "skipped": False,
        "error_codes": body.get("error-codes", []),
    }
