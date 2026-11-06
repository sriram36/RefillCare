import csv
import io
import statistics
import time
from datetime import date
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from core.security import auth, need
from database.session import db, ex, log, q
from rules import days_left, rule
from services.messages import refill_reminder
from services.notifications import notify

router = APIRouter(prefix="/api", tags=["Operations Dashboard"])


@router.get("/dashboard")
def dashboard(u=Depends(auth)):
    need(u, "pharmacist")
    all_orders = q("select * from orders")

    stores = q("select * from stores order by id")
    store_names: dict[int, str] = {s["id"]: s["name"] for s in stores}

    by_store: dict[str, int] = {}
    rejections: dict[str, int] = {}

    for o in all_orders:
        name = store_names.get(o["store_id"], "Not routed")
        by_store[name] = by_store.get(name, 0) + 1

    for i in q("select reason from items where status = 'rejected'"):
        reason = i["reason"] or "No reason given"
        rejections[reason] = rejections.get(reason, 0) + 1

    mins = [
        (o["verified_at"] - o["created"]) / 60
        for o in all_orders
        if o["verified_at"]
    ]

    stock_rows = q("select s.store_id, s.med_id, s.qty, m.name as med_name from stock s join meds m on m.id = s.med_id")
    low_stock_alerts = [
        {
            "store_id": s["store_id"],
            "store_name": store_names.get(s["store_id"], f"Store #{s['store_id']}"),
            "med_id": s["med_id"],
            "med_name": s["med_name"],
            "qty": s["qty"],
        }
        for s in stock_rows
        if s["qty"] <= 5
    ]

    stores_summary = []
    for s in stores:
        sid = s["id"]
        s_orders = [o for o in all_orders if o["store_id"] == sid]
        stores_summary.append({
            "id": sid,
            "name": s["name"],
            "total_orders": len(s_orders),
            "awaiting": sum(1 for o in s_orders if o["status"] == "awaiting_pharmacist"),
            "approved": sum(1 for o in s_orders if o["status"] == "approved"),
            "packed": sum(1 for o in s_orders if o["status"] == "packed"),
            "dispatched": sum(1 for o in s_orders if o["status"] == "dispatched"),
            "low_stock_count": sum(1 for a in low_stock_alerts if a["store_id"] == sid),
        })

    # The success metric "no Schedule H/H1 item dispatched without approval", measured, not claimed:
    # any line on a packed or dispatched order that is blocked, or needs approval and has none.
    unapproved_dispatches = 0
    for it in q(
        "select i.schedule, i.status, i.approved_by from items i join orders o on o.code = i.order_code "
        "where o.status in ('packed', 'dispatched') and i.status != 'rejected'"
    ):
        r = rule(it["schedule"])
        if r["blocked"] or (r["rx"] and not (it["status"] == "approved" and it["approved_by"])):
            unapproved_dispatches += 1

    return {
        "by_store": by_store,
        "rejections": rejections,
        "unapproved_dispatches": unapproved_dispatches,
        "awaiting_now": sum(1 for o in all_orders if o["status"] == "awaiting_pharmacist"),
        "verified_count": len(mins),
        "verify_target_min": 10,
        "median_verify_min": round(statistics.median(mins), 1) if mins else None,
        "register": q("select * from register order by ts desc"),
        "audit": q("select * from audit order by ts desc limit 15"),
        "stores_summary": stores_summary,
        "low_stock_alerts": low_stock_alerts,
        "network_overview": {
            "total_stores": len(stores),
            "active_orders": sum(1 for o in all_orders if o["status"] not in ("dispatched", "rejected")),
            "total_orders": len(all_orders),
        },
    }


@router.post("/stock")
async def upload_stock_csv(file: UploadFile = File(...), u=Depends(auth)):
    need(u, "pharmacist")
    try:
        content = (await file.read()).decode()
        reader = csv.DictReader(io.StringIO(content))
        rows = [
            (int(x["store_id"]), int(x["med_id"]), int(x["qty"]))
            for x in reader
        ]
        assert rows and all(qty >= 0 for _, _, qty in rows)
    except Exception:
        raise HTTPException(
            422, "CSV needs the columns store_id, med_id, qty with whole numbers"
        )

    connection = db()
    connection.executemany("insert or replace into stock values(?, ?, ?)", rows)
    connection.commit()
    connection.close()

    log(u["name"], "stock_upload", f"{len(rows)} rows")
    return {"rows": len(rows)}


@router.post("/reminders/run")
def run_reminders(u=Depends(auth)):
    need(u, "pharmacist")
    count = 0
    notified = []
    today = date.today().isoformat()

    for r in q(
        "select r.*, m.name, u.phone, u.lang from refills r "
        "join meds m on m.id = r.med_id "
        "join users u on u.id = r.customer_id"
    ):
        left = days_left(r["qty"], r["per_day"], r["last_filled"])
        # one reminder per refill per day, whatever language it was sent in
        key = f"refill:{r['id']}"

        if left <= 5 and not q(
            "select 1 x from notes where customer_id = ? and day = ? and key = ?",
            r["customer_id"],
            today,
            key,
            one=True,
        ):
            msg = refill_reminder(r.get("lang") or "en", r["name"].split(",")[0], r["for_name"], left)
            ex(
                "insert into notes(customer_id, text, ts, day, key) values(?, ?, ?, ?, ?)",
                r["customer_id"],
                msg,
                int(time.time()),
                today,
                key,
            )
            if r.get("phone"):
                notify(r["phone"], msg)
                notified.append(r["phone"])
            count += 1

    log(u["name"], "run_reminders", f"{count} sent")
    return {"sent": count, "notified": notified}
