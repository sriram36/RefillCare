from fastapi import APIRouter, Depends, HTTPException
from core.security import (
    auth, check_consent, check_minor_guardian_consent, need
)
from database.session import log, q
from rules import days_left
from services.orderflow import create_refill_order

router = APIRouter(prefix="/api", tags=["Refills & Reminders"])


@router.get("/refills")
def get_refills(u=Depends(auth)):
    need(u, "customer")
    results = []
    query = (
        "select r.*, m.name from refills r "
        "join meds m on m.id = r.med_id where customer_id = ?"
    )
    for r in q(query, u["id"]):
        left = days_left(r["qty"], r["per_day"], r["last_filled"])
        results.append({**r, "days_left": left, "due": left <= 5})
    return sorted(results, key=lambda r: r["days_left"])


@router.post("/refills/{rid}/reorder")
def reorder(rid: int, u=Depends(auth)):
    need(u, "customer")
    check_consent(u)
    r = q(
        "select * from refills where id = ? and customer_id = ?",
        rid,
        u["id"],
        one=True,
    )
    if not r:
        raise HTTPException(404, "Refill not found")

    check_minor_guardian_consent(u, r["for_name"])
    m = q("select * from meds where id = ?", r["med_id"], one=True)

    open_order = q(
        "select o.code from orders o join items i on i.order_code = o.code "
        "where o.customer_id = ? and o.for_name = ? and i.med_id = ? "
        "and o.status in ('awaiting_pharmacist', 'on_hold', 'approved') limit 1",
        u["id"], r["for_name"], r["med_id"], one=True,
    )
    if open_order:
        raise HTTPException(409, f"You already have this refill in progress ({open_order['code']})")

    result = create_refill_order(u, r["for_name"], m, r["qty"])
    log(u["name"], "reorder", result["code"])
    return result


@router.get("/notes")
def get_notes(u=Depends(auth)):
    need(u, "customer")
    return q(
        "select * from notes where customer_id = ? order by ts desc limit 10",
        u["id"],
    )
