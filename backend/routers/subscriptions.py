import time
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.security import auth, need, check_consent, check_minor_guardian_consent
from database.session import ex, q, log
from rules import rule
from services.orderflow import create_refill_order

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])


class SubscriptionCreate(BaseModel):
    for_name: str
    med_id: int
    qty: int = 30
    per_day: int = 1
    frequency_days: int = 30


@router.get("")
def list_subscriptions(u=Depends(auth)):
    if u["role"] == "customer":
        rows = q(
            "select s.*, m.name as med_name, m.price, m.schedule from subscriptions s join meds m on s.med_id = m.id where s.customer_id = ? order by s.created desc",
            u["id"],
        )
    else:
        rows = q(
            "select s.*, m.name as med_name, m.price, m.schedule, u.name as customer_name, u.phone as customer_phone from subscriptions s join meds m on s.med_id = m.id join users u on s.customer_id = u.id order by s.created desc"
        )
    return rows


@router.post("")
def create_subscription(b: SubscriptionCreate, u=Depends(auth)):
    need(u, "customer")
    check_consent(u)

    check_minor_guardian_consent(u, b.for_name)
    if not q("select 1 x from profiles where customer_id = ? and name = ?", u["id"], b.for_name.strip(), one=True):
        raise HTTPException(422, "Choose who this refill is for")
    med = q("select * from meds where id = ? and generic_of is null", b.med_id, one=True)
    if not med:
        raise HTTPException(404, "Medicine not found")
    if rule(med["schedule"])["blocked"]:
        raise HTTPException(422, f"{med['name']} cannot be sold online")
    if not (1 <= b.qty <= 365 and 1 <= b.per_day <= 10 and 7 <= b.frequency_days <= 90):
        raise HTTPException(422, "Check the quantity, daily dose and how often (7 to 90 days)")

    next_date = (date.today() + timedelta(days=b.frequency_days)).isoformat()
    now = int(time.time())

    sub_id = ex(
        "insert into subscriptions(customer_id, for_name, med_id, qty, per_day, frequency_days, next_refill, active, created) values(?, ?, ?, ?, ?, ?, ?, 1, ?)",
        u["id"],
        b.for_name.strip(),
        b.med_id,
        b.qty,
        b.per_day,
        b.frequency_days,
        next_date,
        now,
    )
    log(u["name"], f"create_subscription:{med['name']}", f"sub-{sub_id}")
    return {"id": sub_id, "active": 1, "next_refill": next_date, "med_name": med["name"]}


@router.delete("/{sub_id}")
def cancel_subscription(sub_id: int, u=Depends(auth)):
    need(u, "customer")
    sub = q("select * from subscriptions where id = ?", sub_id, one=True)
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub["customer_id"] != u["id"]:
        raise HTTPException(403, "Not your subscription")

    ex("update subscriptions set active = 0 where id = ?", sub_id)
    log(u["name"], "cancel_subscription", f"sub-{sub_id}")
    return {"id": sub_id, "active": 0}


@router.post("/run")
def run_subscription_engine(u=Depends(auth)):
    need(u, "pharmacist")
    today_str = date.today().isoformat()
    due_subs = q("select * from subscriptions where active = 1 and next_refill <= ?", today_str)
    generated = []

    for s in due_subs:
        med = q("select * from meds where id = ?", s["med_id"], one=True)
        customer = q("select * from users where id = ?", s["customer_id"], one=True)
        if not med or not customer:
            continue

        # s["qty"] is tablets for the whole cycle, so it is turned into packs, not ordered as packs
        order = create_refill_order(customer, s["for_name"], med, s["qty"], "Subscription refill. ")

        next_date = (date.today() + timedelta(days=s.get("frequency_days") or 30)).isoformat()
        ex("update subscriptions set next_refill = ? where id = ?", next_date, s["id"])
        generated.append(order["code"])

    log(u["name"], "run_subscriptions_engine", f"generated:{len(generated)}")
    return {"generated": generated, "count": len(generated)}

