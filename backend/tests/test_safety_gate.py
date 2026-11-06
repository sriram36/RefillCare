"""The hard part of the brief: no Schedule H/H1 item leaves a store without a pharmacist's approval,
and Schedule X / narcotics are never sold online. Every way of creating an order is tried here."""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient

import app as A
import rules as R
from database.session import ex, q
from services import messages
from services.orderflow import insert_order, next_order_code

c = TestClient(A.app)
STAFF = {1: "9000000081", 2: "9000000082", 3: "9000000083"}


def H(phone: str, consent: bool = True) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    headers = {"Authorization": res.json()["token"]}
    if consent and res.json()["user"]["role"] == "customer":
        c.post("/api/consent", headers=headers)
    return headers


@pytest.fixture()
def people():
    return {"debasish": H("9000000001"), "rina": H("9000000002"), "arif": H("9000000003"), "ph": H("9000000099")}


def order_of(code, ph):
    return next(o for o in c.get("/api/orders", headers=ph).json() if o["code"] == code)


def staff_for(code, ph):
    return H(STAFF[order_of(code, ph)["store_id"]])


def upload(cu, demo, who="Mother"):
    res = c.post("/api/orders", data={"for_name": who, "demo": demo}, headers=cu)
    assert res.status_code == 200, res.text
    return res.json()["code"]


def approve_all(code, ph, **extra):
    for it in order_of(code, ph)["items"]:
        if it["status"] == "draft":
            r = c.post(f"/api/items/{it['id']}/decide", json={"action": "approve", **extra}, headers=ph)
            assert r.status_code == 200, r.text


def pack(code, ph, invoice="INV-T"):
    return c.post(f"/api/orders/{code}/pack", json={"invoice": invoice}, headers=staff_for_any(code, ph))


def staff_for_any(code, ph):
    o = order_of(code, ph)
    return H(STAFF[o["store_id"]]) if o["store_id"] else H(STAFF[1])


def assert_blocked_everywhere(code, ph):
    """Nobody can pack or dispatch it: store staff of every store, and the pharmacist."""
    for phone in list(STAFF.values()) + ["9000000099"]:
        h = H(phone)
        for step in ("pack", "dispatch"):
            body = {"invoice": "X"} if step == "pack" else None
            r = c.post(f"/api/orders/{code}/{step}", json=body, headers=h) if body else c.post(f"/api/orders/{code}/{step}", headers=h)
            assert r.status_code in (403, 409), (phone, step, r.status_code, r.text)
    assert order_of(code, ph)["status"] not in ("packed", "dispatched")


# ---- every way of creating an order starts blocked ----

def test_uploaded_prescription_is_blocked_until_approved(people):
    code = upload(people["debasish"], "clean")
    assert all(i["status"] == "draft" and i["approved_by"] is None for i in order_of(code, people["ph"])["items"])
    assert_blocked_everywhere(code, people["ph"])


def test_refill_reorder_is_blocked_until_approved(people):
    ex("update orders set status = 'dispatched' where customer_id = 1 and status in ('awaiting_pharmacist','on_hold','approved')")
    refill = next(r for r in c.get("/api/refills", headers=people["debasish"]).json() if r["for_name"] == "Mother")
    res = c.post(f"/api/refills/{refill['id']}/reorder", headers=people["debasish"])
    assert res.status_code == 200
    assert_blocked_everywhere(res.json()["code"], people["ph"])


def test_subscription_order_is_blocked_until_approved_and_counts_packs(people):
    cu, ph = people["debasish"], people["ph"]
    sub = c.post("/api/subscriptions", json={"for_name": "Mother", "med_id": 1, "qty": 60, "per_day": 2, "frequency_days": 30}, headers=cu)
    assert sub.status_code == 200
    ex("update subscriptions set next_refill = '2000-01-01' where id = ?", sub.json()["id"])
    gen = c.post("/api/subscriptions/run", headers=ph).json()["generated"]
    assert gen
    order = order_of(gen[-1], ph)
    # 60 tablets in strips of 15 is 4 strips. It used to be ordered as 60 strips.
    assert [i["qty"] for i in order["items"]] == [4]
    assert_blocked_everywhere(order["code"], ph)


def test_reupload_cannot_skip_the_queue(people):
    cu, ph = people["arif"], people["ph"]
    code = upload(cu, "blurry", "Arif Mondal")
    assert order_of(code, ph)["status"] == "on_hold"
    assert c.post(f"/api/orders/{code}/reupload", data={"demo": "clean"}, headers=cu).status_code == 200
    assert all(i["status"] == "draft" for i in order_of(code, ph)["items"])
    assert_blocked_everywhere(code, ph)


def test_cart_never_sells_prescription_or_blocked_items(people):
    cu = people["debasish"]
    for med_id in (1, 6, 8, 9):  # Metformin H, Alprazolam H1, Schedule X, narcotic
        res = c.post("/api/cart", json={"lines": [{"med_id": med_id, "qty": 1}], "for_name": "Mother"}, headers=cu)
        assert res.status_code == 422, (med_id, res.text)
    # OTC is the only thing the cart sells
    assert c.post("/api/cart", json={"lines": [{"med_id": 7, "qty": 2}], "for_name": "Mother"}, headers=cu).status_code == 200


def test_unknown_medicine_from_the_ai_is_treated_as_prescription_only(people):
    ex("insert into meds(id, name, schedule, price) values(99, 'Mystery 10 mg, strip of 10', 'ZZ', 50)")
    assert R.rule("ZZ") == R.RULES["H"]
    ok, why = R.can_dispatch([{"name": "Mystery", "schedule": "ZZ", "status": "draft"}])
    assert not ok and "approval" in why


# ---- Schedule X and narcotics ----

def test_schedule_x_and_narcotics_cannot_be_approved_or_sold(people):
    cu, ph = people["debasish"], people["ph"]
    code = upload(cu, "schedx")
    items = order_of(code, ph)["items"]
    blocked = [i for i in items if i["schedule"] in ("X", "NARC")]
    assert blocked and all(i["status"] == "rejected" for i in blocked)
    for i in blocked:  # a pharmacist cannot approve them either
        r = c.post(f"/api/items/{i['id']}/decide", json={"action": "approve"}, headers=ph)
        assert r.status_code == 422


# ---- approval is the only way through, and it is final once packed ----

def test_full_path_works_only_after_approval_and_h1_needs_register(people):
    cu, ph = people["debasish"], people["ph"]
    code = upload(cu, "h1")
    item = order_of(code, ph)["items"][0]
    assert c.post(f"/api/items/{item['id']}/decide", json={"action": "approve"}, headers=ph).status_code == 422
    assert pack(code, ph).status_code in (403, 409)

    approve_all(code, ph, prescriber="Dr P. Mukherjee", patient="M Ghosh")
    # approving the same H1 line again (to edit the quantity) must not write a second register row
    c.post(f"/api/items/{item['id']}/decide", json={"action": "approve", "qty": 1, "prescriber": "Dr P. Mukherjee", "patient": "M Ghosh"}, headers=ph)
    assert len(q("select * from register where item_id = ?", item["id"])) == 1

    assert pack(code, ph).status_code == 200
    assert c.post(f"/api/orders/{code}/dispatch", headers=staff_for(code, ph)).status_code == 200


def test_other_stores_staff_cannot_pack(people):
    cu, ph = people["debasish"], people["ph"]
    code = upload(cu, "clean")
    approve_all(code, ph)
    mine = order_of(code, ph)["store_id"]
    other = H(STAFF[1 if mine != 1 else 2])
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "I"}, headers=other).status_code == 403


def test_decisions_lock_once_packed_or_on_hold(people):
    cu, ph = people["debasish"], people["ph"]
    code = upload(cu, "clean")
    approve_all(code, ph)
    assert pack(code, ph).status_code == 200
    item = order_of(code, ph)["items"][0]
    assert c.post(f"/api/items/{item['id']}/decide", json={"action": "reject", "reason": "changed my mind"}, headers=ph).status_code == 409
    assert c.post(f"/api/orders/{code}/hold", json={"reason": "x"}, headers=ph).status_code == 409

    blurry = upload(cu, "blurry")
    assert order_of(blurry, ph)["status"] == "on_hold"
    # settle() must never flip an on-hold order to approved
    from services.routing import settle
    settle(blurry)
    assert order_of(blurry, ph)["status"] == "on_hold"

    assert c.post("/api/orders/NOPE/hold", json={"reason": "x"}, headers=ph).status_code == 404


# ---- generic substitution ----

def test_generic_needs_consent_and_cannot_change_a_packed_order(people):
    cu, ph = people["debasish"], people["ph"]
    code = upload(cu, "s50211")  # Metformin only
    approve_all(code, ph)
    item = order_of(code, ph)["items"][0]
    assert c.post(f"/api/items/{item['id']}/offer-generic", headers=ph).status_code == 200
    assert pack(code, ph).status_code in (403, 409)  # waiting for the customer's answer

    # the duplicate order-based consent route is gone (it skipped the ownership check)
    assert c.post(f"/api/orders/{code}/consent-generic", json={"item_id": item["id"], "accepted": True}, headers=people["rina"]).status_code in (404, 405)
    # and the real one only answers for the owner
    assert c.post(f"/api/items/{item['id']}/consent", json={"accept": True}, headers=people["rina"]).status_code == 404
    assert c.post(f"/api/items/{item['id']}/consent", json={"accept": True}, headers=cu).status_code == 200
    assert order_of(code, ph)["items"][0]["consent"] == 1
    assert pack(code, ph).status_code == 200

    # packed: no more offers and no re-routing
    store_before = order_of(code, ph)["store_id"]
    assert c.post(f"/api/items/{item['id']}/offer-generic", headers=ph).status_code == 409
    from services.routing import settle
    settle(code)
    after = order_of(code, ph)
    assert after["status"] == "packed" and after["store_id"] == store_before


def test_generic_not_offered_when_no_store_stocks_it(people):
    cu, ph = people["debasish"], people["ph"]
    code = upload(cu, "s50211")
    approve_all(code, ph)
    ex("update stock set qty = 0 where med_id = 10")
    item = order_of(code, ph)["items"][0]
    assert c.post(f"/api/items/{item['id']}/offer-generic", headers=ph).status_code == 422


# ---- stock ----

def test_packing_uses_up_stock_and_never_goes_negative(people):
    cu, ph = people["debasish"], people["ph"]
    code = upload(cu, "s50211")  # 4 strips of Metformin
    approve_all(code, ph)
    store = order_of(code, ph)["store_id"]
    ex("insert or replace into stock(store_id, med_id, qty) values(?, 1, 10)", store)
    assert pack(code, ph).status_code == 200
    assert q("select qty from stock where store_id = ? and med_id = 1", store, one=True)["qty"] == 6

    # a second order that this store can no longer cover is refused at packing, with stock untouched
    code2 = upload(cu, "s50211")
    approve_all(code2, ph)
    s2 = order_of(code2, ph)["store_id"]
    assert s2, "the order should have been routed to a store that had stock at approval time"
    ex("insert or replace into stock(store_id, med_id, qty) values(?, 1, 3)", s2)  # stock fell after routing
    r = pack(code2, ph)
    assert r.status_code == 409 and "stock" in r.json()["detail"].lower()
    assert q("select qty from stock where store_id = ? and med_id = 1", s2, one=True)["qty"] == 3


def test_order_routes_to_a_store_that_has_stock(people):
    cu, ph = people["debasish"], people["ph"]
    ex("update stock set qty = 0 where store_id = 1 and med_id = 1")  # nearest store for Salt Lake is out
    res = c.post("/api/orders", data={"for_name": "Mother", "demo": "s50211", "area": "Salt Lake"}, headers=cu)
    code = res.json()["code"]
    approve_all(code, ph)
    assert order_of(code, ph)["store_id"] != 1


def test_no_single_store_gives_a_clear_reason(people):
    cu, ph = people["debasish"], people["ph"]
    ex("update stock set qty = 0 where med_id = 1")
    code = upload(cu, "s50211")
    approve_all(code, ph)
    o = order_of(code, ph)
    assert o["store_id"] is None and "Metformin" in o["note"]


# ---- transfers ----

def test_only_the_sending_store_fulfils_a_transfer_and_only_once():
    salt_lake, behala = H(STAFF[1]), H(STAFF[2])
    ex("insert or replace into stock(store_id, med_id, qty) values(1, 2, 20)")
    ex("insert or replace into stock(store_id, med_id, qty) values(2, 2, 0)")
    t = c.post("/api/transfers/request", json={"to_store_id": 2, "from_store_id": 1, "med_id": 2, "qty": 8}, headers=behala).json()["id"]
    assert c.post(f"/api/transfers/{t}/fulfill", headers=behala).status_code == 403  # receiver cannot "send" it
    assert c.post(f"/api/transfers/{t}/fulfill", headers=salt_lake).status_code == 200
    assert c.post(f"/api/transfers/{t}/fulfill", headers=salt_lake).status_code == 409  # double tap
    assert q("select qty from stock where store_id = 1 and med_id = 2", one=True)["qty"] == 12
    assert q("select qty from stock where store_id = 2 and med_id = 2", one=True)["qty"] == 8

    big = c.post("/api/transfers/request", json={"to_store_id": 2, "from_store_id": 1, "med_id": 2, "qty": 500}, headers=behala).json()["id"]
    assert c.post(f"/api/transfers/{big}/fulfill", headers=salt_lake).status_code == 409
    assert q("select qty from stock where store_id = 1 and med_id = 2", one=True)["qty"] == 12


# ---- prescriptions ----

def test_refill_reuse_does_not_restart_the_prescription_clock(people):
    cu, ph = people["debasish"], people["ph"]
    ex("update orders set status = 'dispatched' where customer_id = 1 and status in ('awaiting_pharmacist','on_hold','approved')")
    ex("update prescriptions set valid_until = '2099-01-01' where customer_id = 1 and profile_name = 'Mother'")
    refill = next(r for r in c.get("/api/refills", headers=cu).json() if r["for_name"] == "Mother")
    code = c.post(f"/api/refills/{refill['id']}/reorder", headers=cu).json()["code"]
    approve_all(code, ph)
    assert q("select valid_until from prescriptions where customer_id = 1 and profile_name = 'Mother'", one=True)["valid_until"] == "2099-01-01"


def test_new_upload_sets_prescription_validity_from_rules(people, tmp_path, monkeypatch):
    cu, ph = people["rina"], people["ph"]
    ex("delete from prescriptions where customer_id = 2")
    monkeypatch.setattr(R, "RX_VALID_DAYS", 30)
    code = upload(cu, "s50214", "Rina Sen")
    approve_all(code, ph)
    from datetime import date, timedelta
    assert q("select valid_until from prescriptions where customer_id = 2", one=True)["valid_until"] == (date.today() + timedelta(days=30)).isoformat()


# ---- order codes ----

def test_order_codes_are_unique_even_when_two_requests_collide(monkeypatch):
    first = insert_order(1, "Mother", "awaiting_pharmacist")
    codes = iter([first, first, next_order_code()])  # two stale reads of "next code", then a fresh one
    import services.orderflow as OF
    monkeypatch.setattr(OF, "next_order_code", lambda: next(codes))
    second = insert_order(1, "Mother", "awaiting_pharmacist")
    assert second != first
    assert len({r["code"] for r in q("select code from orders")}) == len(q("select code from orders"))


# ---- configurable rules ----

def test_rules_file_is_loaded_and_a_bad_file_stops_startup(tmp_path):
    good = tmp_path / "rules.json"
    good.write_text(json.dumps({"rx_valid_days": 90, "schedules": {"H": {"rx": True, "blocked": False}}}))
    saved_days, saved_rules = R.RX_VALID_DAYS, {k: dict(v) for k, v in R.RULES.items()}
    try:
        R.load_rules(str(good))
        assert R.RX_VALID_DAYS == 90

        bad = tmp_path / "bad.json"
        bad.write_text(json.dumps({"schedules": {"H": {"rx": "no"}}}))
        with pytest.raises(RuntimeError):
            R.load_rules(str(bad))
        broken = tmp_path / "broken.json"
        broken.write_text("{not json")
        with pytest.raises(RuntimeError):
            R.load_rules(str(broken))
    finally:
        R.RX_VALID_DAYS = saved_days
        R.RULES.clear()
        R.RULES.update(saved_rules)


# ---- refill maths ----

def test_pack_and_days_maths():
    from datetime import date, timedelta
    assert R.pack_size("Metformin 500 mg, strip of 15") == 15
    assert R.pack_size("Levothyroxine 50 mcg, bottle of 100") == 100
    assert R.pack_size("Something unlabelled") == 1
    assert R.packs_needed(60, "Metformin 500 mg, strip of 15") == 4  # the brief's RX-50211
    assert R.packs_needed(30, "Telmisartan 40 mg, strip of 10") == 3  # the brief's RX-50214
    assert R.packs_needed(1, "Levothyroxine 50 mcg, bottle of 100") == 1
    today = date(2026, 1, 31)
    assert R.days_left(60, 2, (today - timedelta(days=26)).isoformat(), today) == 4
    assert R.days_left(30, 0, today.isoformat(), today) == 30  # a zero dose cannot crash the reminders


# ---- reminders ----

def test_reminders_go_out_in_the_customers_language_once_a_day(people):
    ph, rina = people["ph"], people["rina"]
    assert c.post("/api/me/language", json={"lang": "xx"}, headers=rina).status_code == 422
    assert c.post("/api/me/language", json={"lang": "bn"}, headers=rina).status_code == 200
    ex("delete from notes")
    assert c.post("/api/reminders/run", headers=ph).json()["sent"] >= 1
    mine = c.get("/api/notes", headers=rina).json()
    assert mine and "দিন" in mine[0]["text"] and "Telmisartan" in mine[0]["text"]
    assert c.post("/api/reminders/run", headers=ph).json()["sent"] == 0  # not twice in a day
    assert "runs out" in messages.refill_reminder("en", "Metformin 500 mg", "Mother", 3)
    assert "खत्म" in messages.refill_reminder("hi", "Metformin 500 mg", "Mother", 0)


# ---- demo reset ----

def test_demo_reset_is_switchable_and_keeps_the_audit_log(monkeypatch):
    import routers.auth as AR
    before = len(q("select * from audit"))
    ex("update users set consent_at = 123 where id = 1")
    ex("update stock set qty = 1")
    assert c.post("/api/demo/reset").status_code == 200
    assert len(q("select * from audit")) >= before  # access log is never wiped
    assert q("select qty from stock where store_id = 1 and med_id = 1", one=True)["qty"] == 40
    # the seeded customers are back to their starting state, so the consent step can be shown again
    assert q("select consent_at from users where id = 1", one=True)["consent_at"] is None
    monkeypatch.setattr(AR, "DEMO_MODE", False)
    assert c.post("/api/demo/reset").status_code == 404


# ---- dashboard numbers are measured, not claimed ----

def test_dashboard_counts_approval_breaches_and_reports_real_verification_time(people):
    ph = people["ph"]
    d = c.get("/api/dashboard", headers=ph).json()
    assert d["unapproved_dispatches"] == 0
    assert d["verify_target_min"] == 10
    # the seeded sample order was verified in 7 minutes: under the target, not exactly on it
    assert d["median_verify_min"] is not None and d["median_verify_min"] < 10

    # simulate the failure the metric exists to catch: a packed order with an unapproved Schedule H line
    code = insert_order(1, "Mother", "packed")
    ex("insert into items(order_code, med_id, name, schedule, qty, price, conf, status) values(?, 1, 'Metformin', 'H', 1, 120, 1, 'draft')", code)
    assert c.get("/api/dashboard", headers=ph).json()["unapproved_dispatches"] == 1

    # a blocked schedule counts too, even if someone marked it approved
    ex("update items set status = 'approved', approved_by = 9, schedule = 'X' where order_code = ?", code)
    assert c.get("/api/dashboard", headers=ph).json()["unapproved_dispatches"] == 1
    ex("update orders set status = 'rejected' where code = ?", code)
    assert c.get("/api/dashboard", headers=ph).json()["unapproved_dispatches"] == 0


def test_dashboard_with_no_verified_orders_reports_none_not_a_made_up_figure(people):
    ex("update orders set verified_at = null")
    assert c.get("/api/dashboard", headers=people["ph"]).json()["median_verify_min"] is None


def test_sample_prescription_is_big_enough_to_read():
    import io
    from PIL import Image, ImageFilter, ImageStat
    from services.ocr import demo_png

    def sheet(kind):
        return Image.open(io.BytesIO(demo_png(kind))).convert("L")

    for kind in ("clean", "handwritten", "s50214", "h1"):
        im = sheet(kind)
        assert im.size[0] >= 700 and im.size[1] >= 380
        # printed text is large: dark pixels exist in several separate horizontal bands, each tall enough to read
        dark_rows = [y for y in range(im.size[1]) if im.crop((0, y, im.size[0], y + 1)).getextrema()[0] < 120]
        assert len(dark_rows) >= 60

    # the blurry sample really is blurrier, which is what sends the order back for a new photo
    sharp_edges = ImageStat.Stat(sheet("clean").filter(ImageFilter.FIND_EDGES)).var[0]
    blurry_edges = ImageStat.Stat(sheet("blurry").filter(ImageFilter.FIND_EDGES)).var[0]
    assert blurry_edges < sharp_edges / 3
    assert demo_png("not-a-sample") == b""


def test_accepting_a_generic_does_not_open_the_door_to_a_duplicate_refill_order(people):
    rina, ph = people["rina"], people["ph"]
    refill = next(r for r in c.get("/api/refills", headers=rina).json() if r["name"].startswith("Telmisartan"))
    assert refill["generic_med_id"], "the refill list should say which generic belongs to this medicine"

    # RX-50214 is Rina's open Telmisartan order. Approve it, offer the generic, and she accepts.
    approve_all("RX-50214", ph)
    item = order_of("RX-50214", ph)["items"][0]
    assert c.post(f"/api/items/{item['id']}/offer-generic", headers=ph).status_code == 200
    assert c.post(f"/api/items/{item['id']}/consent", json={"accept": True}, headers=rina).status_code == 200
    assert order_of("RX-50214", ph)["items"][0]["med_id"] == refill["generic_med_id"]  # the order now holds the generic

    # the order is still open, so a second tap on the refill must still be refused
    again = c.post(f"/api/refills/{refill['id']}/reorder", headers=rina)
    assert again.status_code == 409 and "RX-50214" in again.json()["detail"]


# ---- the pharmacist can add a line the AI missed ----

def test_pharmacist_can_add_a_line_when_the_ai_read_nothing(people):
    ph = people["ph"]
    # a real photo with no AI available: an order with a prescription but no lines read
    code = insert_order(1, "Mother", "awaiting_pharmacist", note="Automatic reading unavailable. Pharmacist will read it manually.")
    assert order_of(code, ph)["items"] == []

    assert c.post(f"/api/orders/{code}/items", json={"med_id": 1, "qty": 2}, headers=ph).status_code == 200
    item = order_of(code, ph)["items"][0]
    assert (item["name"].startswith("Metformin"), item["schedule"], item["qty"], item["status"]) == (True, "H", 2, "draft")
    assert item["reason"] == "Added by pharmacist"  # the screen shows this instead of an AI confidence

    # it is a draft like any other line: nobody can pack it until it is approved
    assert_blocked_everywhere(code, ph)
    approve_all(code, ph)
    assert order_of(code, ph)["status"] == "approved" and order_of(code, ph)["store_id"]


def test_adding_a_line_to_an_approved_order_sends_it_back_for_checking(people):
    cu, ph = people["debasish"], people["ph"]
    code = upload(cu, "s50211")
    approve_all(code, ph)
    assert order_of(code, ph)["status"] == "approved" and order_of(code, ph)["store_id"]

    assert c.post(f"/api/orders/{code}/items", json={"med_id": 7, "qty": 1}, headers=ph).status_code == 200  # paracetamol
    o = order_of(code, ph)
    assert o["status"] == "awaiting_pharmacist" and o["store_id"] is None
    assert pack(code, ph).status_code in (403, 409)  # the new line is unchecked, so the whole order waits
    approve_all(code, ph)
    assert order_of(code, ph)["status"] == "approved"


def test_adding_a_line_is_limited_to_pharmacists_and_safe_medicines(people):
    cu, ph = people["debasish"], people["ph"]
    code = insert_order(1, "Mother", "awaiting_pharmacist")
    url = f"/api/orders/{code}/items"
    assert c.post(url, json={"med_id": 1, "qty": 1}, headers=cu).status_code == 403            # not a customer action
    assert c.post(url, json={"med_id": 999, "qty": 1}, headers=ph).status_code == 404          # not in the catalogue
    assert c.post(url, json={"med_id": 10, "qty": 1}, headers=ph).status_code == 404           # a generic is offered, not added
    assert c.post(url, json={"med_id": 8, "qty": 1}, headers=ph).status_code == 422            # Schedule X
    assert c.post(url, json={"med_id": 9, "qty": 1}, headers=ph).status_code == 422            # narcotic
    assert c.post(url, json={"med_id": 1, "qty": 0}, headers=ph).status_code == 422
    assert c.post(url, json={"med_id": 1, "qty": 51}, headers=ph).status_code == 422
    assert c.post("/api/orders/NOPE/items", json={"med_id": 1, "qty": 1}, headers=ph).status_code == 404
    assert order_of(code, ph)["items"] == []  # none of those left anything behind


def test_lines_cannot_be_added_once_an_order_is_on_hold_or_packed(people):
    ph = people["ph"]
    for status in ("on_hold", "packed", "dispatched"):
        code = insert_order(1, "Mother", status)
        assert c.post(f"/api/orders/{code}/items", json={"med_id": 1, "qty": 1}, headers=ph).status_code == 409, status


def test_catalogue_search_is_for_pharmacists_and_hides_generics(people):
    ph, cu = people["ph"], people["debasish"]
    assert c.get("/api/medicines?term=metf", headers=cu).status_code == 403
    names = [m["name"] for m in c.get("/api/medicines?term=metf", headers=ph).json()]
    assert names and all(n.startswith("Metformin") and "(generic)" not in n for n in names)
    everything = c.get("/api/medicines", headers=ph).json()
    assert 1 < len(everything) <= 20 and all("(generic)" not in m["name"] for m in everything)


# ---- the root page says whether AI reading is on, without leaking anything ----

def test_root_reports_whether_ai_reading_is_configured_and_never_leaks_the_keys(monkeypatch):
    import core.config as cfg
    monkeypatch.setattr(cfg, "AZURE_ENDPOINT", "")
    monkeypatch.setattr(cfg, "AZURE_KEY", "")
    assert c.get("/").json()["ai_reading"] is False

    monkeypatch.setattr(cfg, "AZURE_ENDPOINT", "https://example.openai.azure.com")
    monkeypatch.setattr(cfg, "AZURE_KEY", "super-secret-key-123")
    body = c.get("/")
    assert body.json()["ai_reading"] is True
    assert "super-secret-key-123" not in body.text and "example.openai.azure.com" not in body.text

    monkeypatch.setattr(cfg, "AZURE_KEY", "")  # an endpoint without a key is not enough
    assert c.get("/").json()["ai_reading"] is False
