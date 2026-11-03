import os
import shutil
import time
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from core.config import STORE
from core.security import (
    auth, check_consent, check_minor_guardian_consent, need
)
from database.session import ex, log, q

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
        filled_date = date.fromisoformat(r["last_filled"])
        days_supply = r["qty"] // r["per_day"]
        left = (filled_date + timedelta(days=days_supply) - date.today()).days
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
    order_count = q("select count(*) n from orders", one=True)["n"]
    code = f"RX-{50220 + order_count}"

    today_str = date.today().isoformat()
    valid_rx = q(
        "select * from prescriptions where customer_id = ? and profile_name = ? and valid_until >= ? order by valid_until desc limit 1",
        u["id"],
        r["for_name"],
        today_str,
        one=True,
    )

    if valid_rx and valid_rx["rx_file"] and os.path.exists(os.path.join(STORE, valid_rx["rx_file"])):
        rx_file = f"{code}.enc"
        shutil.copyfile(os.path.join(STORE, valid_rx["rx_file"]), os.path.join(STORE, rx_file))
        status = "awaiting_pharmacist"
        note = f"Prescription on file, valid until {valid_rx['valid_until']}"
    else:
        rx_file = None
        status = "on_hold"
        note = "Please upload a current prescription"

    ex(
        "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created) values(?, ?, ?, ?, ?, ?, ?, ?)",
        code,
        u["id"],
        r["for_name"],
        status,
        None,
        rx_file,
        note,
        int(time.time()),
    )
    ex(
        "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        code,
        m["id"],
        m["name"],
        m["schedule"],
        max(1, r["qty"] // 15),
        m["price"],
        1.0,
        "draft",
        None,
        "",
    )
    log(u["name"], "reorder", code)
    return {"code": code, "status": status, "note": note}


@router.get("/notes")
def get_notes(u=Depends(auth)):
    need(u, "customer")
    return q(
        "select * from notes where customer_id = ? order by ts desc limit 10",
        u["id"],
    )
