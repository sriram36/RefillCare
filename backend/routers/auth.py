import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.config import DEMO_MODE
from core.security import (
    auth, check_rate_limit, record_failed_login,
    reset_failed_login, tok, need
)
from database.session import ex, log, q
from services.messages import LANGS

router = APIRouter(prefix="/api", tags=["Auth & User"])


class LoginRequest(BaseModel):
    phone: str
    otp: str
    name: str = ""


@router.post("/login")
def login(b: LoginRequest):
    raw_phone = b.phone.strip()
    digits = "".join(filter(str.isdigit, raw_phone))
    check_phone = digits if len(digits) >= 10 else raw_phone
    check_rate_limit(check_phone)

    if b.otp != "123456" or len(digits) < 10:
        record_failed_login(check_phone)
        raise HTTPException(401, "Wrong phone or OTP (demo OTP is 123456)")

    phone = digits
    user = q("select * from users where phone = ?", phone, one=True)
    if not user:
        user_name = b.name.strip()[:60] if b.name and b.name.strip() else f"User {phone[-4:]}"
        ex("insert into users(name, phone, role) values(?, ?, 'customer')", user_name, phone)
        user = q("select * from users where phone = ?", phone, one=True)
        if user:
            ex("insert into profiles(customer_id, name, relation) values(?, ?, 'Self')", user["id"], user_name)

    reset_failed_login(phone)
    token_ver = user.get("token_ver") or 1
    return {"token": tok(user["id"], token_ver), "user": user}


@router.post("/logout")
def logout(u=Depends(auth)):
    ex(
        "update users set token_ver = coalesce(token_ver, 1) + 1 where id = ?",
        u["id"],
    )
    log(u["name"], "logout", f"user {u['id']}")
    return {"ok": True}


@router.post("/consent")
def give_consent(u=Depends(auth)):
    need(u, "customer")
    now = int(time.time())
    ex("update users set consent_at = ? where id = ?", now, u["id"])
    log(u["name"], "grant_consent", f"user-{u['id']}")
    return {"ok": True, "consent_at": now}


@router.get("/me/export")
def export_my_data(u=Depends(auth)):
    need(u, "customer")
    my_orders = q(
        "select * from orders where customer_id = ? order by created desc, code desc",
        u["id"],
    )
    for o in my_orders:
        o["items"] = q("select * from items where order_code = ?", o["code"])
    my_profiles = q("select * from profiles where customer_id = ?", u["id"])
    my_notes = q("select * from notes where customer_id = ? order by ts desc", u["id"])
    my_prescriptions = q("select * from prescriptions where customer_id = ?", u["id"])
    return {
        "user": {
            "id": u["id"],
            "name": u["name"],
            "phone": u["phone"],
            "role": u["role"],
            "consent_at": u.get("consent_at"),
        },
        "profiles": my_profiles,
        "orders": my_orders,
        "notes": my_notes,
        "prescriptions": my_prescriptions,
    }

class LanguageRequest(BaseModel):
    lang: str


@router.post("/me/language")
def set_language(b: LanguageRequest, u=Depends(auth)):
    """Remember the language so reminders reach the customer in it."""
    if b.lang not in LANGS:
        raise HTTPException(422, "Choose English, Bengali or Hindi")
    ex("update users set lang = ? where id = ?", b.lang, u["id"])
    return {"ok": True, "lang": b.lang}


@router.post("/demo/reset")
def reset_demo():
    if not DEMO_MODE:
        raise HTTPException(404, "Not available")
    from database.seed import reset_demo_data
    return reset_demo_data()
