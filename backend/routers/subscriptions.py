import time
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.security import auth, need, check_consent
from database.session import ex, q, log
from rules import RX_VALID_DAYS

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

    med = q("select * from meds where id = ?", b.med_id, one=True)
    if not med:
        raise HTTPException(404, "Medicine not found")

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
        order_count = q("select count(*) n from orders", one=True)["n"]
        code = f"RX-{50220 + order_count}"
        now = int(time.time())

        # Check prescription on file
        rx_rec = q(
            "select * from prescriptions where customer_id = ? and profile_name = ? and valid_until >= ? order by valid_until desc limit 1",
            s["customer_id"],
            s["for_name"],
            today_str,
            one=True,
        )
        rx_file = rx_rec["rx_file"] if rx_rec else None
        status = "awaiting_pharmacist" if rx_file else "on_hold"
        note = "Automated subscription refill order." if rx_file else "Subscription on hold: please upload updated prescription."

        ex(
            "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created) values(?, ?, ?, ?, ?, ?, ?, ?)",
            code,
            s["customer_id"],
            s["for_name"],
            status,
            None,
            rx_file,
            note,
            now,
        )

        med = q("select * from meds where id = ?", s["med_id"], one=True)
        if med:
            ex(
                "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                code,
                med["id"],
                med["name"],
                med["schedule"],
                s["qty"],
                med["price"],
                1.0,
                "draft",
                None,
                "",
            )

        # Advance next_refill
        next_date = (date.today() + timedelta(days=s.get("frequency_days") or 30)).isoformat()
        ex("update subscriptions set next_refill = ? where id = ?", next_date, s["id"])
        generated.append(code)

    log(u["name"], "run_subscriptions_engine", f"generated:{len(generated)}")
    return {"generated": generated, "count": len(generated)}

