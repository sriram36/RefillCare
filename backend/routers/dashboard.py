import csv
import io
import statistics
from datetime import date, timedelta
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from core.config import REMINDER_HOUR
from core.security import auth, need
from database.session import db, log, q
from rules import rule
from services import reminders
from services.notifications import mask
from services.reminders import send_due_reminders

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
        if o["status"] == "rejected" and not o["store_id"]:
            continue  # turned down before any store was chosen: not waiting to be routed
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

    today = date.today()
    per_day = {(today - timedelta(days=n)).isoformat(): 0 for n in range(20, -1, -1)}
    for o in all_orders:
        day = date.fromtimestamp(o["created"]).isoformat()
        if day in per_day:
            per_day[day] += 1
    last_auto = q("select ts from audit where action = 'auto_reminders' order by ts desc limit 1", one=True)
    outbox = [
        {"ts": m["ts"], "channel": m["channel"], "to": mask(m["phone"] or ""), "text": m["text"]}
        for m in q("select * from outbox order by ts desc, id desc limit 8")
    ]

    return {
        "by_store": by_store,
        "orders_per_day": [{"day": d, "orders": n} for d, n in per_day.items()],
        "reminder_schedule": {
            "automatic": reminders.SCHEDULER_ON and REMINDER_HOUR >= 0,
            "hour": REMINDER_HOUR,
            "last_run": last_auto["ts"] if last_auto else None,
        },
        "outbox": outbox,
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
    result = send_due_reminders()
    log(u["name"], "run_reminders", f"{result['sent']} sent")
    return result
