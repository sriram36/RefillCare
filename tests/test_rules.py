import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")
from fastapi.testclient import TestClient
import app as A, rules as R
c = TestClient(A.app)
def H(phone): return {"Authorization": c.post("/api/login", json={"phone": phone, "otp": "123456"}).json()["token"]}
def S(code, ph):
    o = next(i for i in c.get("/api/orders", headers=ph).json() if i["code"] == code)
    return H(f"900000008{o['store_id'] or 1}")  # store staff for the order
it = lambda s, st, by=None: dict(name="x", schedule=s, status=st, approved_by=by)

def test_gate_unit():
    assert not R.can_dispatch([it("H", "draft")])[0]
    assert not R.can_dispatch([it("H", "approved", None)])[0]
    assert R.can_dispatch([it("H", "approved", 9), it("OTC", "draft")])[0]
    assert not R.can_dispatch([it("X", "approved", 9)])[0]
    assert not R.can_dispatch([it("H", "rejected")])[0]
    assert not R.can_dispatch([it("ZZ", "draft")])[0]  # unknown schedule is strict
def test_routing_nearest_with_stock():
    s = [dict(id=1, name="a", lat=22.58, lng=88.41, stock={1: 0}), dict(id=2, name="b", lat=22.50, lng=88.31, stock={1: 5})]
    assert R.route(s, [(1, 2)], 22.58, 88.41)["id"] == 2
    assert R.route(s, [(1, 9)], 22.58, 88.41) is None
def test_h_order_cannot_dispatch_until_approved():
    cu, ph = H("9000000001"), H("9000000099")
    code = c.post("/api/orders", data={"for_name": "Mother", "demo": "clean"}, headers=cu).json()["code"]
    r1 = c.post(f"/api/orders/{code}/pack", json={"invoice": "INV-1"}, headers=ph); assert r1.status_code == 403  # pharmacists cannot pack
    r1 = c.post(f"/api/orders/{code}/pack", json={"invoice": "INV-1"}, headers=S(code, ph)); assert r1.status_code == 403 and r1.json()["detail"]["code"] == "APPROVAL_REQUIRED"
    for i in c.get("/api/orders", headers=ph).json():
        if i["code"] == code:
            for x in i["items"]: assert c.post(f"/api/items/{x['id']}/decide", json={"action": "approve"}, headers=ph).status_code == 200
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "INV-1"}, headers=S(code, ph)).status_code == 200
    assert c.post(f"/api/orders/{code}/dispatch", headers=S(code, ph)).status_code == 200
def test_unreadable_and_restricted_and_roles():
    cu = H("9000000001")
    b = c.post("/api/orders", data={"for_name": "Mother", "demo": "blurry"}, headers=cu).json()["code"]
    x = c.post("/api/orders", data={"for_name": "Mother", "demo": "schedx"}, headers=cu).json()["code"]
    o = {i["code"]: i for i in c.get("/api/orders", headers=cu).json()}
    assert o[b]["status"] == "on_hold"
    assert [i["status"] for i in o[x]["items"] if i["schedule"] == "NARC"] == ["rejected"]
    assert c.post("/api/items/1/decide", json={"action": "approve"}, headers=cu).status_code == 403
    assert c.get("/api/orders/RX-50214/rx", headers=cu).status_code == 403
    assert c.post("/api/orders", data={"for_name": "Mother"}, headers=cu).status_code == 400

def _approve_all(code, ph, **extra):
    o = next(i for i in c.get("/api/orders", headers=ph).json() if i["code"] == code)
    for x in o["items"]: assert c.post(f"/api/items/{x['id']}/decide", json={"action": "approve", **extra}, headers=ph).status_code == 200
    return next(i for i in c.get("/api/orders", headers=ph).json() if i["code"] == code)
def test_generic_needs_customer_consent():
    cu, ph = H("9000000001"), H("9000000099")
    code = c.post("/api/orders", data={"for_name": "Mother", "demo": "clean"}, headers=cu).json()["code"]
    o = _approve_all(code, ph); m = next(x for x in o["items"] if x["generic"])
    assert c.post(f"/api/items/{m['id']}/offer-generic", headers=ph).status_code == 200
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "I1"}, headers=S(code, ph)).status_code == 403
    assert c.post(f"/api/items/{m['id']}/consent", json={"accept": True}, headers=cu).status_code == 200
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "I1"}, headers=S(code, ph)).status_code == 200
    assert c.post(f"/api/items/{m['id']}/consent", json={"accept": True}, headers=H("9000000002")).status_code == 404
def test_h1_needs_register_details():
    cu, ph = H("9000000001"), H("9000000099")
    code = c.post("/api/orders", data={"for_name": "Mother", "demo": "h1"}, headers=cu).json()["code"]
    it = next(i for i in c.get("/api/orders", headers=ph).json() if i["code"] == code)["items"][0]
    assert c.post(f"/api/items/{it['id']}/decide", json={"action": "approve"}, headers=ph).status_code == 422
    _approve_all(code, ph, prescriber="Dr A. Banerjee", patient="M Ghosh")
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "I2"}, headers=S(code, ph)).status_code == 200
    assert any(r["order_code"] == code for r in c.get("/api/dashboard", headers=ph).json()["register"])
def test_dashboard_stock_and_invoice():
    cu, ph = H("9000000001"), H("9000000099")
    assert c.get("/api/dashboard", headers=cu).status_code == 403
    assert c.get("/api/dashboard", headers=ph).json()["median_verify_min"] is not None
    assert c.post("/api/stock", files={"file": ("s.csv", b"a,b\n1,2")}, headers=ph).status_code == 422
    assert c.post("/api/stock", files={"file": ("s.csv", b"store_id,med_id,qty\n1,1,7")}, headers=ph).status_code == 200
    assert c.post("/api/orders/RX-50214/pack", json={"invoice": " "}, headers=ph).status_code == 422

def test_profiles_payment_area_validation():
    cu = H("9000000001")
    assert c.post("/api/orders", data={"for_name": "Stranger", "demo": "clean"}, headers=cu).status_code == 422
    assert c.post("/api/orders", data={"for_name": "Mother", "demo": "clean", "payment": "bitcoin"}, headers=cu).status_code == 422
    assert c.post("/api/orders", data={"for_name": "Mother", "demo": "clean", "area": "Mars"}, headers=cu).status_code == 422
    assert c.post("/api/profiles", json={"name": "Mother"}, headers=cu).status_code == 409
    assert c.post("/api/profiles", json={"name": "Uncle Raj", "relation": "Uncle"}, headers=cu).status_code == 200
    code = c.post("/api/orders", data={"for_name": "Uncle Raj", "demo": "clean", "payment": "upi_test", "area": "Behala"}, headers=cu).json()["code"]
    o = next(i for i in c.get("/api/orders", headers=cu).json() if i["code"] == code)
    assert o["payment"] == "upi_test" and o["paid"] == 1
def test_reminders_once_a_day_and_role():
    cu, ph = H("9000000001"), H("9000000099")
    assert c.post("/api/reminders/run", headers=cu).status_code == 403
    assert c.post("/api/reminders/run", headers=ph).json()["sent"] >= 1
    assert c.post("/api/reminders/run", headers=ph).json()["sent"] == 0
    assert c.get("/api/notes", headers=cu).json()

def test_sample_orders_have_prescription_images():
    ph = H("9000000099")
    for code in ("RX-50211", "RX-50214", "RX-50219"):
        r = c.get(f"/api/orders/{code}/rx", headers=ph); assert r.status_code == 200 and r.content[:4] == b"\x89PNG"

def test_store_staff_scope():
    cu, ph = H("9000000001"), H("9000000099"); salt, behala = H("9000000081"), H("9000000082")
    assert c.get("/api/orders/RX-50214/rx", headers=behala).status_code == 403  # store staff never see prescriptions
    assert all(o["store_id"] == 2 for o in c.get("/api/orders", headers=behala).json())
    r1 = c.post("/api/orders/RX-50214/pack", json={"invoice": "X1"}, headers=behala)
    assert r1.status_code == 403 and r1.json()["detail"]["code"] == "APPROVAL_REQUIRED"  # sample order still waits for the pharmacist
    assert c.post("/api/orders/RX-50211/dispatch", headers=behala).status_code == 403  # wrong store
    assert c.post("/api/orders/RX-50211/dispatch", headers=salt).status_code == 200

def test_search_and_cart_rules():
    cu = H("9000000001"); ph = H("9000000099")
    hits = {m["name"].split(",")[0]: m["rule"] for m in c.get("/api/search?term=mg", headers=cu).json()}
    assert hits.get("Paracetamol 500 mg") == "ok" and hits.get("Metformin 500 mg") == "rx" and hits.get("Demo Narcotic 5 mg") == "blocked"
    ids = {m["name"].split(",")[0]: m["id"] for m in c.get("/api/search?term=mg", headers=cu).json()}
    body = lambda mid: {"for_name": "Mother", "lines": [{"med_id": mid, "qty": 2}]}
    assert c.post("/api/cart", json=body(ids["Metformin 500 mg"]), headers=cu).status_code == 422
    assert c.post("/api/cart", json=body(ids["Demo Narcotic 5 mg"]), headers=cu).status_code == 422
    assert c.post("/api/cart", json={**body(ids["Paracetamol 500 mg"]), "for_name": "Stranger"}, headers=cu).status_code == 422
    assert c.post("/api/cart", json={"for_name": "Mother", "lines": []}, headers=cu).status_code == 422
    assert c.post("/api/cart", json=body(ids["Paracetamol 500 mg"]), headers=ph).status_code == 403
    code = c.post("/api/cart", json=body(ids["Paracetamol 500 mg"]), headers=cu).json()["code"]
    o = next(i for i in c.get("/api/orders", headers=cu).json() if i["code"] == code)
    assert o["status"] == "approved" and o["store"]
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "C1"}, headers=S(code, ph)).status_code == 200
