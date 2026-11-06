"""Demo notifications and the daily reminder timer. Nothing here sends a real message."""

import asyncio
import os
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")

from fastapi.testclient import TestClient

import app as A
from database.session import ex, q
from services import reminders
from services.messages import order_update

c = TestClient(A.app)
STAFF = {1: "9000000081", 2: "9000000082", 3: "9000000083"}


def H(phone: str) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    headers = {"Authorization": res.json()["token"]}
    if res.json()["user"]["role"] == "customer":
        c.post("/api/consent", headers=headers)
    return headers


def utc(h, m=0, day=6):
    return datetime(2026, 11, day, h, m, tzinfo=timezone.utc)


def test_the_timer_fires_once_a_day_from_nine_in_the_morning_india_time():
    assert not reminders.due_now(utc(3, 29), None, 9)  # 08:59 in India
    assert reminders.due_now(utc(3, 30), None, 9)  # 09:00 in India
    assert reminders.due_now(utc(15), None, 9), "started in the afternoon: today's run is still owed"
    assert not reminders.due_now(utc(15), "2026-11-06", 9), "already sent today"
    assert reminders.due_now(utc(4, 0, day=7), "2026-11-06", 9), "and again the next day"
    assert not reminders.due_now(utc(15), None, -1), "-1 turns the timer off"
    assert not reminders.due_now(utc(20, 0), "2026-11-07", 9), "07 Nov 01:30 India time belongs to the 7th, already done"


def test_the_scheduler_sends_once_records_it_and_keeps_going(monkeypatch):
    ex("delete from notes")
    ex("delete from outbox")
    ex("delete from audit where action = 'auto_reminders'")
    monkeypatch.setattr(reminders, "due_now", lambda now, last_day, hour=9: last_day is None)

    async def run_for_a_moment():
        try:
            await asyncio.wait_for(reminders.scheduler(check_every_s=0.05), timeout=0.6)
        except asyncio.TimeoutError:
            pass

    asyncio.run(run_for_a_moment())
    assert q("select count(*) n from audit where action = 'auto_reminders'", one=True)["n"] == 1, "once, not on every check"
    assert q("select count(*) n from notes where customer_id = 1", one=True)["n"] == 1, "Debasish got his reminder"
    assert q("select count(*) n from outbox", one=True)["n"] >= 1
    assert reminders.SCHEDULER_ON


def test_a_failing_pass_does_not_stop_the_scheduler(monkeypatch):
    ex("delete from audit where action = 'auto_reminders'")
    calls = []

    def boom():
        calls.append(1)
        raise RuntimeError("database busy")

    monkeypatch.setattr(reminders, "send_due_reminders", boom)
    monkeypatch.setattr(reminders, "due_now", lambda now, last_day, hour=9: True)

    async def run_for_a_moment():
        try:
            await asyncio.wait_for(reminders.scheduler(check_every_s=0.05), timeout=0.4)
        except asyncio.TimeoutError:
            pass

    asyncio.run(run_for_a_moment())
    assert len(calls) >= 2, "it tried again after the failure"


def test_reminders_are_demo_messages_the_pharmacist_can_read_with_numbers_hidden():
    ex("delete from notes")
    ex("delete from outbox")
    ph = H("9000000099")
    assert c.post("/api/reminders/run", headers=ph).json()["sent"] >= 1
    d = c.get("/api/dashboard", headers=ph).json()
    assert d["outbox"] and d["outbox"][0]["channel"] == "WhatsApp"
    assert all("9000000001" not in m["to"] and "••" in m["to"] for m in d["outbox"]), "the full number never reaches the screen"
    assert "reminder_schedule" in d and d["reminder_schedule"]["hour"] == 9
    assert [row["orders"] for row in d["orders_per_day"]] and len(d["orders_per_day"]) == 21
    assert sum(r["orders"] for r in d["orders_per_day"]) >= 36, "the past orders show up in the chart"


def test_the_customer_hears_about_each_step_in_their_own_language():
    ph, rina = H("9000000099"), H("9000000002")
    c.post("/api/me/language", json={"lang": "hi"}, headers=rina)
    ex("delete from notes where customer_id = 2")
    ex("delete from outbox")

    order = next(o for o in c.get("/api/orders", headers=ph).json() if o["code"] == "RX-50214")
    for it in order["items"]:
        assert c.post(f"/api/items/{it['id']}/decide", json={"action": "approve"}, headers=ph).status_code == 200
    mine = lambda: [n["text"] for n in c.get("/api/notes", headers=rina).json()]
    approved = [t for t in mine() if "RX-50214" in t]
    assert len(approved) == 1 and "मंज़ूर" in approved[0] and "Behala" in approved[0], approved

    order = next(o for o in c.get("/api/orders", headers=ph).json() if o["code"] == "RX-50214")
    staff = H(STAFF[order["store_id"]])
    assert c.post("/api/orders/RX-50214/pack", json={"invoice": "N1"}, headers=staff).status_code == 200
    assert c.post("/api/orders/RX-50214/dispatch", json={}, headers=staff).status_code == 200
    texts = mine()
    assert any("पैक" in t for t in texts) and any("रास्ते" in t for t in texts)
    assert len([t for t in texts if "RX-50214" in t]) == 3, "one message per step, never repeated"
    assert q("select count(*) n from outbox where customer_id = 2", one=True)["n"] == 3
    assert all(r["channel"] == "SMS" for r in q("select * from outbox where customer_id = 2"))


def test_holding_an_order_tells_the_customer_and_a_second_hold_does_not_repeat_it():
    ph, arif = H("9000000099"), H("9000000003")
    ex("delete from notes where customer_id = 3")
    for _ in range(2):
        assert c.post("/api/orders/RX-50219/hold", json={"reason": "Please send a clearer photo."}, headers=ph).status_code == 200
    held = [n["text"] for n in c.get("/api/notes", headers=arif).json() if "RX-50219" in n["text"]]
    assert len(held) == 1 and "clearer" in held[0]


def test_every_message_exists_in_every_language():
    for lang in ("en", "bn", "hi"):
        for event in ("approved", "rejected", "on_hold", "packed", "dispatched"):
            text = order_update(lang, event, "RX-1", "Salt Lake")
            assert "RX-1" in text and text.strip()
    assert "Salt Lake" in order_update("en", "approved", "RX-1", "Salt Lake")
    assert "finding a store" in order_update("en", "approved", "RX-1", "")
