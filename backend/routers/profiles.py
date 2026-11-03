import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.security import auth, need
from core.storage import delete_rx
from database.session import ex, log, q
from rules import rule
from services.routing import settle

router = APIRouter(prefix="/api", tags=["Customer Profiles & Catalog"])


class Consent(BaseModel):
    accept: bool


class Profile(BaseModel):
    name: str
    relation: str = "Family"
    is_minor: bool = False
    guardian_consent: bool = False


@router.get("/search")
def search(term: str = "", u=Depends(auth)):
    need(u, "customer")
    term_clean = term.strip()[:40]
    if len(term_clean) < 2:
        return []

    rows = q(
        "select id, name, schedule, price from meds where generic_of is null and name like ? limit 10",
        f"%{term_clean}%",
    )
    for m in rows:
        m_rule = rule(m["schedule"])
        if m_rule["blocked"]:
            m["rule"] = "blocked"
        elif m_rule["rx"]:
            m["rule"] = "rx"
        else:
            m["rule"] = "ok"
    return rows


@router.get("/profiles")
def get_profiles(u=Depends(auth)):
    need(u, "customer")
    return q("select * from profiles where customer_id = ?", u["id"])


@router.post("/profiles")
def add_profile(b: Profile, u=Depends(auth)):
    need(u, "customer")
    name = b.name.strip()[:60]
    if not name:
        raise HTTPException(422, "Enter a name")

    if b.is_minor and not b.guardian_consent:
        raise HTTPException(422, "Guardian consent is required for profiles under 18")

    if q(
        "select 1 x from profiles where customer_id = ? and name = ?",
        u["id"],
        name,
        one=True,
    ):
        raise HTTPException(409, "This person is already added")

    ex(
        "insert into profiles(customer_id, name, relation, is_minor, guardian_consent) values(?, ?, ?, ?, ?)",
        u["id"],
        name,
        b.relation.strip()[:30],
        1 if b.is_minor else 0,
        1 if b.guardian_consent else 0,
    )
    return {"ok": True}


@router.post("/items/{iid}/consent")
def consent(iid: int, b: Consent, u=Depends(auth)):
    need(u, "customer")
    it = q(
        "select i.*, o.customer_id cid from items i join orders o on o.code = i.order_code where i.id = ?",
        iid,
        one=True,
    )
    if not it or it["cid"] != u["id"] or not it["offer"] or it["consent"] is not None:
        raise HTTPException(404, "No generic offer to answer")

    if b.accept:
        g = q("select * from meds where id = ?", it["offer"], one=True)
        orig_price = it.get("original_price") or it["price"]
        ex(
            "update items set med_id = ?, name = ?, price = ?, consent = 1, original_price = ? where id = ?",
            g["id"],
            g["name"],
            g["price"],
            orig_price,
            iid,
        )
    else:
        ex("update items set consent = 0 where id = ?", iid)

    log(u["name"], "generic_accept" if b.accept else "generic_decline", f"item {iid}")
    settle(it["order_code"])
    return {"ok": True}


@router.post("/me/forget")
def forget_me(u=Depends(auth)):
    need(u, "customer")
    uid = u["id"]
    now = int(time.time())

    # 1. Fetch user's orders to identify prescriptions for cleanup
    user_orders = q("select code, rx_file from orders where customer_id = ?", uid)
    for o in user_orders:
        if o.get("rx_file"):
            # Check if any items in this order are Schedule H1
            has_h1 = q("select 1 from register where order_code = ?", o["code"], one=True)
            if not has_h1:
                delete_rx(o["rx_file"])
                ex("update orders set rx_file = null where code = ?", o["code"])

    # 2. Delete non-statutory family profiles and notes
    ex("delete from profiles where customer_id = ?", uid)
    ex("delete from notes where customer_id = ?", uid)
    ex("delete from subscriptions where customer_id = ?", uid)

    # 3. Anonymize user record and revoke tokens
    anonymized_phone = f"erased_{uid}_{now}"
    ex(
        "update users set name = 'Anonymized Patient', phone = ?, consent_at = null, token_ver = token_ver + 1 where id = ?",
        anonymized_phone,
        uid,
    )
    log("dpdp_compliance", f"erasure_completed:user-{uid}", f"user-{uid}")
    return {
        "status": "erased",
        "retained_statutory": "Schedule H1 regulatory register preserved per Drugs & Cosmetics Rule 65",
    }
