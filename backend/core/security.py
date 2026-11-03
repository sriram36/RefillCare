import hashlib
import hmac
import time
from fastapi import Header, HTTPException
from core.config import SECRET
from database.session import q

FAILED_LOGINS: dict[str, list[float]] = {}


def check_rate_limit(phone: str):
    now = time.time()
    window = 600  # 10 minutes
    attempts = [t for t in FAILED_LOGINS.get(phone, []) if now - t < window]
    FAILED_LOGINS[phone] = attempts
    if len(attempts) >= 5:
        raise HTTPException(
            429,
            "Too many failed login attempts. Please wait 10 minutes.",
        )


def record_failed_login(phone: str):
    now = time.time()
    window = 600
    attempts = [t for t in FAILED_LOGINS.get(phone, []) if now - t < window]
    attempts.append(now)
    FAILED_LOGINS[phone] = attempts


def reset_failed_login(phone: str):
    FAILED_LOGINS.pop(phone, None)


def tok(uid: int, token_ver: int = 1, exp: int | None = None) -> str:
    exp = exp or int(time.time()) + 43200  # 12 hour sessions
    payload = f"{uid}.{token_ver}.{exp}"
    signature = hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    return f"{uid}.{token_ver}.{exp}.{signature}"


def auth(authorization: str = Header("")):
    try:
        parts = authorization.split(".")
        if len(parts) == 3:
            uid, exp, sig = parts
            token_ver = 1
            expected_sig = hmac.new(
                SECRET.encode(), f"{uid}.{exp}".encode(), hashlib.sha256
            ).hexdigest()[:24]
        elif len(parts) == 4:
            uid, token_ver_str, exp, sig = parts
            token_ver = int(token_ver_str)
            expected_sig = tok(int(uid), token_ver, int(exp)).split(".")[3]
        else:
            raise ValueError("Invalid token format")

        if int(exp) <= time.time():
            raise ValueError("Token expired")
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("Invalid signature")

        user = q("select * from users where id = ?", int(uid), one=True)
        if not user:
            raise ValueError("User not found")
        current_ver = user.get("token_ver") or 1
        if int(token_ver) != current_ver:
            raise ValueError("Token revoked")
        return user
    except Exception:
        raise HTTPException(401, "Sign in again")


def need(user: dict | None, role: str):
    if not user or user.get("role") != role:
        raise HTTPException(403, "Not allowed for your role")


def check_consent(u: dict):
    if u.get("role") == "customer" and not u.get("consent_at"):
        raise HTTPException(
            403,
            {"code": "CONSENT_REQUIRED", "message": "Consent is required to place or manage health orders"},
        )


def check_minor_guardian_consent(u: dict, for_name: str):
    prof = q(
        "select * from profiles where customer_id = ? and name = ?",
        u["id"],
        for_name.strip(),
        one=True,
    )
    if prof and prof.get("is_minor") and not prof.get("guardian_consent"):
        raise HTTPException(
            422,
            "Cannot place orders for a minor profile without recorded guardian consent",
        )
