from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.security import auth, need
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
