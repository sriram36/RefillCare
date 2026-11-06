"""The sample store network and its past orders: what the dashboard shows on day one, and that none of it breaks the safety gate."""

import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")

from fastapi.testclient import TestClient

import app as A
from database.seed import init, reset_demo_data, sync_network
from database.session import SCHEMA, ex, q
from services.network import HISTORY_CUSTOMERS, HISTORY_ORDERS, STORES, build_history

c = TestClient(A.app)


def H(phone: str) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    headers = {"Authorization": res.json()["token"]}
    if res.json()["user"]["role"] == "customer":
        c.post("/api/consent", headers=headers)
    return headers


def test_the_network_has_fifteen_stores_and_three_staff_logins():
    assert len(STORES) == 15 and len({s[0] for s in STORES}) == 15 and len({s[1] for s in STORES}) == 15
    assert q("select count(*) n from stores", one=True)["n"] == 15
    assert q("select count(*) n from users where role = 'store'", one=True)["n"] == 3
    assert all(22.4 < lat < 22.8 and 88.2 < lng < 88.6 for _, _, lat, lng in STORES), "every store is around Kolkata"


def test_past_orders_are_closed_and_belong_to_their_own_customers():
    history_ids = {u[0] for u in HISTORY_CUSTOMERS}
    past = q("select * from orders where customer_id >= 11")
    assert len(past) == HISTORY_ORDERS
    assert {o["customer_id"] for o in past} <= history_ids
    assert {o["status"] for o in past} == {"dispatched", "rejected"}, "nothing from the past is waiting for anyone"
    # the three sample customers still see only their own sample order
    assert [o["code"] for o in c.get("/api/orders", headers=H("9000000001")).json()] == ["RX-50211"]
    assert [o["code"] for o in c.get("/api/orders", headers=H("9000000002")).json()] == ["RX-50214"]
    # and the pharmacist queue still has just the one order that needs checking
    queue = [o for o in c.get("/api/orders", headers=H("9000000099")).json() if o["status"] == "awaiting_pharmacist"]
    assert [o["code"] for o in queue] == ["RX-50214"]


def test_every_past_line_was_decided_by_the_pharmacist_and_h1_lines_are_in_the_register():
    lines = q("select i.*, o.status ostatus from items i join orders o on o.code = i.order_code where o.customer_id >= 11")
    assert lines and not [i for i in lines if i["status"] == "draft"]
    for i in lines:
        if i["ostatus"] == "dispatched":
            assert i["status"] == "approved" and i["approved_by"] == 9
        else:
            assert i["status"] == "rejected" and i["reason"]
    h1 = [i for i in lines if i["schedule"] == "H1" and i["ostatus"] == "dispatched"]
    assert h1, "the register needs some history to show"
    for i in h1:
        row = q("select * from register where item_id = ?", i["id"], one=True)
        assert row and row["prescriber"] and row["patient"]
    assert not [i for i in lines if i["schedule"] in ("X", "NARC")], "restricted items never appear in an order"


def test_the_dashboard_shows_a_real_picture_and_is_still_honest():
    d = c.get("/api/dashboard", headers=H("9000000099")).json()
    assert d["unapproved_dispatches"] == 0
    assert d["network_overview"]["total_stores"] == 15
    assert d["network_overview"]["total_orders"] == HISTORY_ORDERS + 3
    assert d["verified_count"] > 25 and d["median_verify_min"] < d["verify_target_min"]
    assert sum(d["rejections"].values()) >= 4 and len(d["rejections"]) >= 3
    assert "Not routed" not in d["by_store"] or d["by_store"]["Not routed"] == 0, "a rejected order is not waiting for a store"
    assert len([s for s in d["stores_summary"] if s["total_orders"] > 0]) >= 10
    assert len(d["register"]) >= 4
    assert any(a["store_id"] > 3 for a in d["low_stock_alerts"]), "the new stores show up in the stock alerts too"


def test_a_new_order_still_routes_to_the_nearest_store_that_has_everything():
    cu = H("9000000003")
    res = c.post("/api/cart", json={"for_name": "Arif Mondal", "payment": "cod", "area": "Salt Lake", "lines": [{"med_id": 7, "qty": 1}]}, headers=cu)
    assert res.status_code == 200
    order = q("select * from orders where customer_id = 3 and code != 'RX-50219' order by created desc limit 1", one=True)
    assert order["store_id"] == 1, "the Salt Lake store is the one closest to a Salt Lake address"


def test_history_is_repeatable():
    a, b = build_history(1_700_000_000), build_history(1_700_000_000)
    assert a == b, "the same seed gives the same history, so a reset always looks the same"
    codes = [o[0] for o in a["orders"]]
    assert len(codes) == len(set(codes)) == HISTORY_ORDERS


def test_a_reset_brings_the_past_back_and_keeps_the_sample_orders():
    ex("delete from orders where customer_id >= 11")
    ex("delete from register")
    reset_demo_data()
    assert q("select count(*) n from orders", one=True)["n"] == HISTORY_ORDERS + 3
    assert q("select count(*) n from users where id >= 11", one=True)["n"] == len(HISTORY_CUSTOMERS)
    assert q("select count(*) n from profiles where customer_id >= 11", one=True)["n"] == len(HISTORY_CUSTOMERS)
    reset_demo_data()
    assert q("select count(*) n from users where id >= 11", one=True)["n"] == len(HISTORY_CUSTOMERS), "no duplicate customers"
    assert q("select count(*) n from profiles where customer_id >= 11", one=True)["n"] == len(HISTORY_CUSTOMERS)
    assert q("select count(*) n from refills where customer_id >= 11", one=True)["n"] == len(HISTORY_CUSTOMERS)


def test_an_older_database_gets_the_stores_but_no_made_up_orders(monkeypatch):
    old = tempfile.mktemp(suffix=".db")
    con = sqlite3.connect(old)
    con.executescript(SCHEMA)
    con.execute("insert into stores values(1, 'Salt Lake', 22.5867, 88.4171)")
    con.execute("insert into stores values(2, 'Behala EDITED', 22.4985, 88.3118)")
    con.commit()
    con.close()
    monkeypatch.setenv("DB_PATH", old)
    init()
    assert q("select count(*) n from stores", one=True)["n"] == 15
    assert q("select name from stores where id = 2", one=True)["name"] == "Behala EDITED", "an edited store is left alone"
    assert q("select count(*) n from orders", one=True)["n"] == 0, "a real database is never filled with sample orders"
    sync_network()
    assert q("select count(*) n from stores", one=True)["n"] == 15, "running it again changes nothing"
