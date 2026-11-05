import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.security import (
    auth, check_rate_limit, record_failed_login,
    reset_failed_login, tok, need
)
from database.session import ex, log, q

router = APIRouter(prefix="/api", tags=["Auth & User"])


class LoginRequest(BaseModel):
    phone: str
    otp: str


@router.post("/login")
def login(b: LoginRequest):
    phone = b.phone.strip()
    check_rate_limit(phone)
    user = q("select * from users where phone = ?", phone, one=True)
    if not user or b.otp != "123456":
        record_failed_login(phone)
        raise HTTPException(401, "Wrong phone or OTP (demo OTP is 123456)")
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
    log(u["name"], "grant_consent", str(now))
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

@router.post("/demo/reset")
def reset_demo():
    from database.seed import reset_demo_data
    return reset_demo_data()
