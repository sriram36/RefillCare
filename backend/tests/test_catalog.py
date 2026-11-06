"""The medicine catalogue behind "Find a medicine": its data, its search, and how it reaches existing databases."""

import csv
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")

from fastapi.testclient import TestClient

import app as A
from database.seed import init, sync_catalog
from database.session import SCHEMA, ex, q
from rules import RULES
from services.catalog import CATALOG, CATEGORIES, GENERICS

c = TestClient(A.app)
STOCK_CSV = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "stock.csv")


def H(phone: str) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    headers = {"Authorization": res.json()["token"]}
    if res.json()["user"]["role"] == "customer":
        c.post("/api/consent", headers=headers)
    return headers


def find(headers, **params):
    res = c.get("/api/search", params=params, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def short(m):  # "Metformin 500 mg, strip of 15" -> "Metformin 500 mg"
    return m["name"].split(",")[0]


# ---- the data itself ----

def test_catalogue_data_is_consistent():
    ids = [m[0] for m in CATALOG] + [g[0] for g in GENERICS]
    names = [m[1] for m in CATALOG] + [g[1] for g in GENERICS]
    assert len(ids) == len(set(ids)) and len(names) == len(set(names))

    by_id = {m[0]: m for m in CATALOG}
    for med_id, name, sched, price, cat in CATALOG:
        assert sched in RULES, f"{name}: unknown schedule {sched}"
        assert cat in CATEGORIES or cat == "Restricted", name
        assert ", " in name, f"{name}: the screens split 'medicine, pack' on the comma"
        assert price > 0 or RULES[sched]["blocked"], name
    parents = []
    for med_id, name, sched, price, parent, cat in GENERICS:
        assert parent in by_id, f"{name}: no such medicine to replace"
        assert by_id[parent][2] == sched, f"{name}: a generic must keep the schedule of the medicine it replaces"
        assert by_id[parent][3] > price and "(generic)" in name
        parents.append(parent)
    assert len(parents) == len(set(parents)), "one generic per medicine: the offer uses the one that exists"


def test_starting_stock_covers_every_sellable_medicine_in_every_store_and_no_blocked_one():
    with open(STOCK_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    sellable = {m[0] for m in CATALOG if not RULES[m[2]]["blocked"]} | {g[0] for g in GENERICS}
    blocked = {m[0] for m in CATALOG if RULES[m[2]]["blocked"]}
    seen = {(int(r["store_id"]), int(r["med_id"])) for r in rows}
    assert seen == {(s, m) for s in (1, 2, 3) for m in sellable}
    assert not any(m in blocked for _, m in seen), "Schedule X and narcotics are never stocked for sale"
    assert all(int(r["qty"]) >= 0 for r in rows)


def test_a_fresh_database_gets_the_whole_catalogue_with_groups():
    assert q("select count(*) n from meds", one=True)["n"] == len(CATALOG) + len(GENERICS)
    assert q("select count(*) n from meds where category is null", one=True)["n"] == 0
    assert q("select count(*) n from stock", one=True)["n"] == 141


# ---- the safety rule must survive a bigger catalogue ----

def test_the_cart_sells_only_over_the_counter_medicines():
    cu = H("9000000001")
    for med_id, name, sched, *_ in CATALOG:
        res = c.post("/api/cart", json={"lines": [{"med_id": med_id, "qty": 1}], "for_name": "Mother"}, headers=cu)
        expected = 200 if sched == "OTC" else 422
        assert res.status_code == expected, f"{name} ({sched}): expected {expected}, got {res.status_code}"


# ---- search ----

def test_search_by_group_by_name_and_by_both():
    cu = H("9000000001")

    chol = find(cu, category="Cholesterol")
    assert {short(m) for m in chol} == {"Atorvastatin 10 mg", "Atorvastatin 20 mg", "Rosuvastatin 10 mg"}
    assert all(m["category"] == "Cholesterol" and m["rule"] == "rx" for m in chol)

    para = find(cu, term="paracetamol")
    assert {short(m) for m in para} == {"Paracetamol 500 mg", "Paracetamol 650 mg"} and all(m["rule"] == "ok" for m in para)

    assert "Metformin 500 mg" in {short(m) for m in find(cu, term="diabetes")}  # a group name finds its medicines
    assert [short(m) for m in find(cu, category="Pain and fever", term="650")] == ["Paracetamol 650 mg"]

    assert find(cu, term="p") == [] and find(cu) == []  # a name needs two letters
    assert find(cu, category="No such group") == []


def test_restricted_items_show_as_blocked_and_generics_never_appear():
    cu = H("9000000001")
    assert {m["rule"] for m in find(cu, category="Restricted")} == {"blocked"}
    everything = [m for cat in CATEGORIES + ["Restricted"] for m in find(cu, category=cat)]
    assert len(everything) == len(CATALOG)
    assert not any("(generic)" in m["name"] for m in everything)


def test_search_is_a_customer_action():
    assert c.get("/api/search", params={"term": "metformin"}, headers=H("9000000099")).status_code == 403


def test_results_say_how_many_stores_have_it():
    cu = H("9000000001")
    count = lambda term: {short(m): m["stores_in_stock"] for m in find(cu, term=term)}
    assert count("Cefixime")["Cefixime 200 mg"] == 2  # out at Behala, in stock at the other two
    assert count("Azithro")["Azithromycin 500 mg"] == 3  # low at Howrah Maidan, but still in stock
    ex("update stock set qty = 0 where med_id = 43")
    assert count("thermometer")["Digital thermometer"] == 0


# ---- how the catalogue reaches a database that already exists ----

def test_sync_adds_what_is_missing_and_never_overwrites_an_edit():
    ex("delete from meds where id = 40")
    ex("delete from stock where med_id = 40")
    ex("update meds set price = 777 where id = 34")  # someone changed a price
    ex("update stock set qty = 5 where store_id = 2 and med_id = 7")  # someone counted stock
    ex("update meds set category = null where id = 7")  # an older database without groups

    sync_catalog()

    assert q("select name from meds where id = 40", one=True)["name"].startswith("Zinc 20 mg")  # the missing one is back
    assert q("select count(*) n from stock where med_id = 40", one=True)["n"] == 3
    assert q("select price from meds where id = 34", one=True)["price"] == 777  # the edit survives
    assert q("select qty from stock where store_id = 2 and med_id = 7", one=True)["qty"] == 5
    assert q("select category from meds where id = 7", one=True)["category"] == "Pain and fever"  # only a gap is filled

    before = (q("select count(*) n from meds", one=True)["n"], q("select count(*) n from stock", one=True)["n"])
    sync_catalog()
    assert (q("select count(*) n from meds", one=True)["n"], q("select count(*) n from stock", one=True)["n"]) == before


def test_an_old_database_is_upgraded_in_place(monkeypatch, tmp_path):
    """The situation of anyone who already ran the app: nine medicines, no groups, an edited price."""
    old = str(tmp_path / "old.db")
    con = sqlite3.connect(old)
    con.executescript(SCHEMA.replace("generic_of, category)", "generic_of)"))  # the schema before groups existed
    con.executemany(
        "insert into meds(id, name, schedule, price) values(?, ?, ?, ?)",
        [(1, "Metformin 500 mg, strip of 15", "H", 999), (7, "Paracetamol 500 mg, strip of 10", "OTC", 30)],
    )
    con.commit()
    assert "category" not in [r[1] for r in con.execute("pragma table_info(meds)")]
    con.close()

    monkeypatch.setenv("DB_PATH", old)
    init()  # what the app does on start-up when the file already exists

    meds = {r["id"]: r for r in q("select * from meds")}
    assert len(meds) == len(CATALOG) + len(GENERICS)
    assert meds[1]["price"] == 999, "the existing medicine keeps its edited price"
    assert meds[1]["category"] == "Diabetes" and meds[7]["category"] == "Pain and fever"
    assert q("select count(*) n from stock", one=True)["n"] == 141
