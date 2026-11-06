"""Refill reminders: sent by the daily scheduler, or on demand from the pharmacist's screen.

One reminder per refill per day, so running it twice never sends twice."""

import asyncio
import logging
import time
from datetime import date, datetime, timedelta, timezone

from core.config import REMINDER_HOUR
from database.session import ex, log, q
from rules import days_left
from services.messages import refill_reminder
from services.notifications import notify

logger = logging.getLogger("refillcare.reminders")
IST = timezone(timedelta(hours=5, minutes=30))
SCHEDULER_ON = False  # set by the scheduler, so the dashboard can say whether reminders are automatic


def send_due_reminders() -> dict:
    """Message every customer whose medicine runs out within 5 days. Returns how many went out."""
    count, notified = 0, []
    today = date.today().isoformat()
    for r in q(
        "select r.*, m.name, u.phone, u.lang from refills r "
        "join meds m on m.id = r.med_id "
        "join users u on u.id = r.customer_id"
    ):
        left = days_left(r["qty"], r["per_day"], r["last_filled"])
        key = f"refill:{r['id']}"
        if left <= 5 and not q(
            "select 1 x from notes where customer_id = ? and day = ? and key = ?",
            r["customer_id"], today, key, one=True,
        ):
            msg = refill_reminder(r.get("lang") or "en", r["name"].split(",")[0], r["for_name"], left)
            ex(
                "insert into notes(customer_id, text, ts, day, key) values(?, ?, ?, ?, ?)",
                r["customer_id"], msg, int(time.time()), today, key,
            )
            if r.get("phone"):
                notify(r["phone"], msg, r["customer_id"])
                notified.append(r["phone"])
            count += 1
    return {"sent": count, "notified": notified}


def due_now(now: datetime, last_day: str | None, hour: int = REMINDER_HOUR) -> bool:
    """True once a day, from `hour` o'clock India time onwards, if today's run has not happened yet."""
    local = now.astimezone(IST)
    return hour >= 0 and local.hour >= hour and last_day != local.date().isoformat()


async def scheduler(check_every_s: int = 600) -> None:
    """Runs for the life of the app. Checks every 10 minutes and sends the day's reminders once."""
    global SCHEDULER_ON
    SCHEDULER_ON = True
    last_day = None
    while True:
        try:
            if due_now(datetime.now(timezone.utc), last_day):
                result = await asyncio.to_thread(send_due_reminders)
                last_day = datetime.now(IST).date().isoformat()
                log("scheduler", "auto_reminders", f"{result['sent']} sent")
                logger.info("daily reminders: %s sent", result["sent"])
        except Exception:  # a failed pass must never stop the loop; it is tried again in 10 minutes
            logger.exception("daily reminders failed")
        await asyncio.sleep(check_every_s)
