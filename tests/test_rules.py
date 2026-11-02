import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")

from fastapi.testclient import TestClient

import app as A
import rules as R

c = TestClient(A.app)


def H(phone: str, consent: bool = True) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    token = res.json()["token"]
    headers = {"Authorization": token}
    if consent and res.json().get("user", {}).get("role") == "customer":
        c.post("/api/consent", headers=headers)
    return headers


def S(code: str, ph: dict) -> dict:
    orders = c.get("/api/orders", headers=ph).json()
    order = next(i for i in orders if i["code"] == code)
    store_staff_id = order["store_id"] or 1
    return H(f"900000008{store_staff_id}")  # store staff for the order


def it(schedule: str, status: str, approved_by: int | None = None) -> dict:
    return {
        "name": "x",
        "schedule": schedule,
        "status": status,
        "approved_by": approved_by,
    }


def test_gate_unit():
    assert not R.can_dispatch([it("H", "draft")])[0]
    assert not R.can_dispatch([it("H", "approved", None)])[0]
    assert R.can_dispatch([it("H", "approved", 9), it("OTC", "draft")])[0]
    assert not R.can_dispatch([it("X", "approved", 9)])[0]
    assert not R.can_dispatch([it("H", "rejected")])[0]
    assert not R.can_dispatch([it("ZZ", "draft")])[0]  # unknown schedule is strict


def test_routing_nearest_with_stock():
    stores = [
        {"id": 1, "name": "a", "lat": 22.58, "lng": 88.41, "stock": {1: 0}},
        {"id": 2, "name": "b", "lat": 22.50, "lng": 88.31, "stock": {1: 5}},
    ]
    assert R.route(stores, [(1, 2)], 22.58, 88.41)["id"] == 2
    assert R.route(stores, [(1, 9)], 22.58, 88.41) is None


def test_h_order_cannot_dispatch_until_approved():
    cu = H("9000000001")
    ph = H("9000000099")
    code = c.post(
        "/api/orders",
        data={"for_name": "Mother", "demo": "clean"},
        headers=cu,
    ).json()["code"]

    # Pharmacists cannot pack
    r1 = c.post(f"/api/orders/{code}/pack", json={"invoice": "INV-1"}, headers=ph)
    assert r1.status_code == 403

    # Store staff cannot pack until approved
    r2 = c.post(
        f"/api/orders/{code}/pack",
        json={"invoice": "INV-1"},
        headers=S(code, ph),
    )
    assert r2.status_code == 403
    assert r2.json()["detail"]["code"] == "APPROVAL_REQUIRED"

    # Pharmacist approves items
    for order in c.get("/api/orders", headers=ph).json():
        if order["code"] == code:
            for item in order["items"]:
                appr_res = c.post(
                    f"/api/items/{item['id']}/decide",
                    json={"action": "approve"},
                    headers=ph,
                )
                assert appr_res.status_code == 200

    # Store staff packs and dispatches
    pack_res = c.post(
        f"/api/orders/{code}/pack",
        json={"invoice": "INV-1"},
        headers=S(code, ph),
    )
    assert pack_res.status_code == 200
    dispatch_res = c.post(f"/api/orders/{code}/dispatch", headers=S(code, ph))
    assert dispatch_res.status_code == 200


def test_unreadable_and_restricted_and_roles():
    cu = H("9000000001")
    code_blurry = c.post(
        "/api/orders",
        data={"for_name": "Mother", "demo": "blurry"},
        headers=cu,
    ).json()["code"]
    code_schedx = c.post(
        "/api/orders",
        data={"for_name": "Mother", "demo": "schedx"},
        headers=cu,
    ).json()["code"]

    orders_map = {i["code"]: i for i in c.get("/api/orders", headers=cu).json()}
    assert orders_map[code_blurry]["status"] == "on_hold"

    narc_statuses = [
        item["status"]
        for item in orders_map[code_schedx]["items"]
        if item["schedule"] == "NARC"
    ]
    assert narc_statuses == ["rejected"]

    assert c.post("/api/items/1/decide", json={"action": "approve"}, headers=cu).status_code == 403
    assert c.get("/api/orders/RX-50214/rx", headers=cu).status_code == 403
    assert c.post("/api/orders", data={"for_name": "Mother"}, headers=cu).status_code == 400


def _approve_all(code: str, ph: dict, **extra) -> dict:
    order = next(i for i in c.get("/api/orders", headers=ph).json() if i["code"] == code)
    for x in order["items"]:
        res = c.post(f"/api/items/{x['id']}/decide", json={"action": "approve", **extra}, headers=ph)
        assert res.status_code == 200
    return next(i for i in c.get("/api/orders", headers=ph).json() if i["code"] == code)


def test_generic_needs_customer_consent():
    cu = H("9000000001")
    ph = H("9000000099")
    code = c.post(
        "/api/orders",
        data={"for_name": "Mother", "demo": "clean"},
        headers=cu,
    ).json()["code"]

    order = _approve_all(code, ph)
    item_with_generic = next(x for x in order["items"] if x["generic"])

    assert c.post(f"/api/items/{item_with_generic['id']}/offer-generic", headers=ph).status_code == 200
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "I1"}, headers=S(code, ph)).status_code == 403

    assert c.post(
        f"/api/items/{item_with_generic['id']}/consent",
        json={"accept": True},
        headers=cu,
    ).status_code == 200

    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "I1"}, headers=S(code, ph)).status_code == 200
    assert c.post(
        f"/api/items/{item_with_generic['id']}/consent",
        json={"accept": True},
        headers=H("9000000002"),
    ).status_code == 404


def test_h1_needs_register_details():
    cu = H("9000000001")
    ph = H("9000000099")
    code = c.post(
        "/api/orders",
        data={"for_name": "Mother", "demo": "h1"},
        headers=cu,
    ).json()["code"]

    item = next(i for i in c.get("/api/orders", headers=ph).json() if i["code"] == code)["items"][0]
    assert c.post(f"/api/items/{item['id']}/decide", json={"action": "approve"}, headers=ph).status_code == 422

    _approve_all(code, ph, prescriber="Dr A. Banerjee", patient="M Ghosh")
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "I2"}, headers=S(code, ph)).status_code == 200

    dashboard_register = c.get("/api/dashboard", headers=ph).json()["register"]
    assert any(r["order_code"] == code for r in dashboard_register)


def test_dashboard_stock_and_invoice():
    cu = H("9000000001")
    ph = H("9000000099")
    assert c.get("/api/dashboard", headers=cu).status_code == 403
    assert c.get("/api/dashboard", headers=ph).json()["median_verify_min"] is not None

    bad_csv = c.post("/api/stock", files={"file": ("s.csv", b"a,b\n1,2")}, headers=ph)
    assert bad_csv.status_code == 422

    good_csv = c.post("/api/stock", files={"file": ("s.csv", b"store_id,med_id,qty\n1,1,7")}, headers=ph)
    assert good_csv.status_code == 200

    assert c.post("/api/orders/RX-50214/pack", json={"invoice": " "}, headers=ph).status_code == 422


def test_profiles_payment_area_validation():
    cu = H("9000000001")
    assert c.post("/api/orders", data={"for_name": "Stranger", "demo": "clean"}, headers=cu).status_code == 422
    assert c.post("/api/orders", data={"for_name": "Mother", "demo": "clean", "payment": "bitcoin"}, headers=cu).status_code == 422
    assert c.post("/api/orders", data={"for_name": "Mother", "demo": "clean", "area": "Mars"}, headers=cu).status_code == 422

    assert c.post("/api/profiles", json={"name": "Mother"}, headers=cu).status_code == 409
    assert c.post("/api/profiles", json={"name": "Uncle Raj", "relation": "Uncle"}, headers=cu).status_code == 200

    code = c.post(
        "/api/orders",
        data={"for_name": "Uncle Raj", "demo": "clean", "payment": "upi_test", "area": "Behala"},
        headers=cu,
    ).json()["code"]

    order = next(i for i in c.get("/api/orders", headers=cu).json() if i["code"] == code)
    assert order["payment"] == "upi_test" and order["paid"] == 1


def test_reminders_once_a_day_and_role():
    cu = H("9000000001")
    ph = H("9000000099")
    assert c.post("/api/reminders/run", headers=cu).status_code == 403

    first_run = c.post("/api/reminders/run", headers=ph)
    assert first_run.json()["sent"] >= 1

    second_run = c.post("/api/reminders/run", headers=ph)
    assert second_run.json()["sent"] == 0

    assert c.get("/api/notes", headers=cu).json()


def test_sample_orders_have_prescription_images():
    ph = H("9000000099")
    for code in ("RX-50211", "RX-50214", "RX-50219"):
        res = c.get(f"/api/orders/{code}/rx", headers=ph)
        assert res.status_code == 200 and res.content[:4] == b"\x89PNG"


def test_store_staff_scope():
    ph = H("9000000099")
    salt = H("9000000081")
    behala = H("9000000082")

    # Store staff never see prescriptions
    assert c.get("/api/orders/RX-50214/rx", headers=behala).status_code == 403

    # Store staff only see orders for their own store
    assert all(o["store_id"] == 2 for o in c.get("/api/orders", headers=behala).json())

    # Sample order still waits for pharmacist approval
    r1 = c.post("/api/orders/RX-50214/pack", json={"invoice": "X1"}, headers=behala)
    assert r1.status_code == 403 and r1.json()["detail"]["code"] == "APPROVAL_REQUIRED"

    # Cannot dispatch another store's order
    assert c.post("/api/orders/RX-50211/dispatch", headers=behala).status_code == 403

    # Assigned store can dispatch once approved & packed
    assert c.post("/api/orders/RX-50211/dispatch", headers=salt).status_code == 200


def test_search_and_cart_rules():
    cu = H("9000000001")
    ph = H("9000000099")
    search_res = c.get("/api/search?term=mg", headers=cu).json()
    hits = {m["name"].split(",")[0]: m["rule"] for m in search_res}
    assert hits.get("Paracetamol 500 mg") == "ok"
    assert hits.get("Metformin 500 mg") == "rx"
    assert hits.get("Demo Narcotic 5 mg") == "blocked"

    ids = {m["name"].split(",")[0]: m["id"] for m in search_res}

    def body(mid: int) -> dict:
        return {"for_name": "Mother", "lines": [{"med_id": mid, "qty": 2}]}

    assert c.post("/api/cart", json=body(ids["Metformin 500 mg"]), headers=cu).status_code == 422
    assert c.post("/api/cart", json=body(ids["Demo Narcotic 5 mg"]), headers=cu).status_code == 422
    assert c.post("/api/cart", json={**body(ids["Paracetamol 500 mg"]), "for_name": "Stranger"}, headers=cu).status_code == 422
    assert c.post("/api/cart", json={"for_name": "Mother", "lines": []}, headers=cu).status_code == 422
    assert c.post("/api/cart", json=body(ids["Paracetamol 500 mg"]), headers=ph).status_code == 403

    code = c.post("/api/cart", json=body(ids["Paracetamol 500 mg"]), headers=cu).json()["code"]
    order = next(i for i in c.get("/api/orders", headers=cu).json() if i["code"] == code)
    assert order["status"] == "approved" and order["store"]
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "C1"}, headers=S(code, ph)).status_code == 200


def test_reupload_linked_to_held_order():
    cu1 = H("9000000001")
    cu2 = H("9000000002")

    # Customer 1 uploads blurry prescription -> on_hold
    code = c.post(
        "/api/orders",
        data={"for_name": "Mother", "demo": "blurry"},
        headers=cu1,
    ).json()["code"]
    order = next(i for i in c.get("/api/orders", headers=cu1).json() if i["code"] == code)
    assert order["status"] == "on_hold"

    # Test wrong owner (Customer 2 tries to reupload for Customer 1) -> 403
    r_wrong_owner = c.post(f"/api/orders/{code}/reupload", data={"demo": "clean"}, headers=cu2)
    assert r_wrong_owner.status_code == 403

    # Test still-unreadable path -> stays on_hold
    r_still_blurry = c.post(f"/api/orders/{code}/reupload", data={"demo": "blurry"}, headers=cu1)
    assert r_still_blurry.status_code == 200
    order = next(i for i in c.get("/api/orders", headers=cu1).json() if i["code"] == code)
    assert order["status"] == "on_hold"

    # Test success path -> moves to awaiting_pharmacist with extracted lines
    r_success = c.post(f"/api/orders/{code}/reupload", data={"demo": "clean"}, headers=cu1)
    assert r_success.status_code == 200
    order = next(i for i in c.get("/api/orders", headers=cu1).json() if i["code"] == code)
    assert order["status"] == "awaiting_pharmacist"
    assert len(order["items"]) == 2

    # Test wrong status (now awaiting_pharmacist, not on_hold) -> 409
    r_wrong_status = c.post(f"/api/orders/{code}/reupload", data={"demo": "clean"}, headers=cu1)
    assert r_wrong_status.status_code == 409


def test_prescription_records_for_refills():
    cu1 = H("9000000001")
    cu2 = H("9000000002")
    ph = H("9000000099")

    # 1. Valid record attaches image to refill reorder and moves to awaiting_pharmacist
    refills_cu1 = c.get("/api/refills", headers=cu1).json()
    refill_mother = next(r for r in refills_cu1 if r["for_name"] == "Mother")
    res_reorder = c.post(f"/api/refills/{refill_mother['id']}/reorder", headers=cu1)
    assert res_reorder.status_code == 200
    order_code = res_reorder.json()["code"]
    assert res_reorder.json()["status"] == "awaiting_pharmacist"
    assert "Prescription on file, valid until" in res_reorder.json()["note"]

    # Verify that the prescription image was attached and can be viewed by the pharmacist
    rx_res = c.get(f"/api/orders/{order_code}/rx", headers=ph)
    assert rx_res.status_code == 200 and rx_res.content[:4] == b"\x89PNG"

    # Pharmacist can approve because a valid record and image are attached
    order = next(o for o in c.get("/api/orders", headers=ph).json() if o["code"] == order_code)
    item_id = order["items"][0]["id"]
    appr_res = c.post(f"/api/items/{item_id}/decide", json={"action": "approve"}, headers=ph)
    assert appr_res.status_code == 200

    # 2. Expired or missing record puts refill order on hold with "Please upload a current prescription"
    refills_cu2 = c.get("/api/refills", headers=cu2).json()
    refill_rina = refills_cu2[0]
    res_expired = c.post(f"/api/refills/{refill_rina['id']}/reorder", headers=cu2)
    assert res_expired.status_code == 200
    expired_code = res_expired.json()["code"]
    assert res_expired.json()["status"] == "on_hold"
    assert "Please upload a current prescription" in res_expired.json()["note"]

    # 3. Approval refused (422) if prescription-only item has no image and no valid record
    expired_order = next(o for o in c.get("/api/orders", headers=ph).json() if o["code"] == expired_code)
    expired_item_id = expired_order["items"][0]["id"]
    refuse_res = c.post(f"/api/items/{expired_item_id}/decide", json={"action": "approve"}, headers=ph)
    assert refuse_res.status_code == 422


def test_dpdp_consent_and_minors():
    # Customer 3 starts without consent
    cu3_no_consent = H("9000000003", consent=False)

    # 1. Orders and uploads return 403 CONSENT_REQUIRED until consent given
    res_order = c.post("/api/orders", data={"for_name": "Arif Mondal", "demo": "clean"}, headers=cu3_no_consent)
    assert res_order.status_code == 403
    assert res_order.json()["detail"]["code"] == "CONSENT_REQUIRED"

    res_cart = c.post(
        "/api/cart",
        json={"for_name": "Arif Mondal", "lines": [{"med_id": 7, "qty": 1}]},
        headers=cu3_no_consent,
    )
    assert res_cart.status_code == 403
    assert res_cart.json()["detail"]["code"] == "CONSENT_REQUIRED"

    # 2. POST /api/consent records the timestamp
    consent_res = c.post("/api/consent", headers=cu3_no_consent)
    assert consent_res.status_code == 200
    assert consent_res.json()["consent_at"] > 0

    # 3. After consent given, ordering succeeds
    res_order_ok = c.post("/api/orders", data={"for_name": "Arif Mondal", "demo": "clean"}, headers=cu3_no_consent)
    assert res_order_ok.status_code == 200

    # 4. Profiles under 18 require guardian consent
    res_minor_fail = c.post(
        "/api/profiles",
        json={"name": "Child A", "relation": "Son", "is_minor": True, "guardian_consent": False},
        headers=cu3_no_consent,
    )
    assert res_minor_fail.status_code == 422

    res_minor_ok = c.post(
        "/api/profiles",
        json={"name": "Child A", "relation": "Son", "is_minor": True, "guardian_consent": True},
        headers=cu3_no_consent,
    )
    assert res_minor_ok.status_code == 200

    # 5. GET /api/me/export returns only own data
    export_res = c.get("/api/me/export", headers=cu3_no_consent)
    assert export_res.status_code == 200
    data = export_res.json()
    assert data["user"]["phone"] == "9000000003"
    assert any(p["name"] == "Child A" for p in data["profiles"])
    # Ensure other customer profiles/orders are not leaked
    assert not any(p["name"] == "Mother" for p in data["profiles"])


def test_signin_rate_limiting_and_logout():
    test_phone = "9000000077"
    # Seed or use test user
    A.ex("insert or ignore into users(id, name, phone, role) values(77, 'RateLimit Test', '9000000077', 'customer')")

    # 5 wrong attempts
    for _ in range(5):
        r = c.post("/api/login", json={"phone": test_phone, "otp": "999999"})
        assert r.status_code == 401

    # 6th attempt trips rate limit -> 429
    r_locked = c.post("/api/login", json={"phone": test_phone, "otp": "123456"})
    assert r_locked.status_code == 429
    assert "Too many failed login attempts" in r_locked.json()["detail"]

    # Reset rate limit tracker for clean state
    A.reset_failed_login(test_phone)
    login_res = c.post("/api/login", json={"phone": test_phone, "otp": "123456"})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": token}

    # Verify token works
    assert c.get("/api/profiles", headers=headers).status_code == 200

    # Logout bumps token version
    logout_res = c.post("/api/logout", headers=headers)
    assert logout_res.status_code == 200

    # Old token is now rejected with 401
    assert c.get("/api/profiles", headers=headers).status_code == 401


def test_upi_reference_and_delivery_partner():
    cu = H("9000000001")
    ph = H("9000000099")

    # Order placed with UPI generates a mock UTR reference
    code = c.post(
        "/api/orders",
        data={"for_name": "Mother", "demo": "clean", "payment": "upi_test", "area": "Salt Lake"},
        headers=cu,
    ).json()["code"]

    order = next(i for i in c.get("/api/orders", headers=cu).json() if i["code"] == code)
    assert order["payment"] == "upi_test"
    assert order["paid"] == 1
    assert order["payment_ref"] is not None and order["payment_ref"].startswith("UTR")

    # Approve all items
    _approve_all(code, ph)

    # Store staff packs with invoice
    staff_headers = S(code, ph)
    assert c.post(f"/api/orders/{code}/pack", json={"invoice": "INV-UPI-1"}, headers=staff_headers).status_code == 200

    # Store staff dispatches with delivery partner
    disp_res = c.post(
        f"/api/orders/{code}/dispatch",
        json={"partner": "Kolkata Express Courier"},
        headers=staff_headers,
    )
    assert disp_res.status_code == 200
    assert disp_res.json()["delivery_partner"] == "Kolkata Express Courier"

    # Customer and pharmacist can see delivery partner
    order_updated = next(i for i in c.get("/api/orders", headers=cu).json() if i["code"] == code)
    assert order_updated["status"] == "dispatched"
    assert order_updated["delivery_partner"] == "Kolkata Express Courier"


def test_reminders_notification_stub():
    ph = H("9000000099")
    cu = H("9000000001")

    # Clean today's notes for customer 1 so reminder can trigger
    A.ex("delete from notes where customer_id = ?", 1)

    res = c.post("/api/reminders/run", headers=ph)
    assert res.status_code == 200
    data = res.json()
    assert data["sent"] >= 1
    # Customer phone should be notified
    assert "9000000001" in data.get("notified", [])

    # Customer sees the note in notes
    notes = c.get("/api/notes", headers=cu).json()
    assert any("runs out in about" in n["text"] for n in notes)


def test_order_audit_trail_and_dashboard_summary():
    cu = H("9000000001")
    ph = H("9000000099")
    code = "RX-50211"

    # Pharmacist viewing rx logs audit trail
    c.get(f"/api/orders/{code}/rx", headers=ph)

    # Pharmacist can query order audit trail
    audit_res = c.get(f"/api/orders/{code}/audit", headers=ph)
    assert audit_res.status_code == 200
    audit_entries = audit_res.json()
    assert any(a["action"] in ("view_rx", "upload_rx", "ask_reupload") for a in audit_entries)

    # Customer cannot access audit trail (DPDP role enforcement)
    assert c.get(f"/api/orders/{code}/audit", headers=cu).status_code == 403

    # Pharmacist dashboard has 46-store / network summary & low stock alerts
    dash = c.get("/api/dashboard", headers=ph).json()
    assert "stores_summary" in dash
    assert len(dash["stores_summary"]) >= 3
    assert all("total_orders" in s and "low_stock_count" in s for s in dash["stores_summary"])
    assert "low_stock_alerts" in dash
    assert "network_overview" in dash
    assert dash["network_overview"]["total_stores"] >= 3


def test_generic_savings_calculation():
    cu = H("9000000001")
    ph = H("9000000099")

    # Place order with clean demo (has Metformin, which has generic option)
    code = c.post(
        "/api/orders",
        data={"for_name": "Mother", "demo": "clean"},
        headers=cu,
    ).json()["code"]

    order = _approve_all(code, ph)
    item_with_generic = next(x for x in order["items"] if x["generic"])

    # Offer generic
    assert c.post(f"/api/items/{item_with_generic['id']}/offer-generic", headers=ph).status_code == 200

    # Accept generic
    c.post(
        f"/api/items/{item_with_generic['id']}/consent",
        json={"accept": True},
        headers=cu,
    )

    # Verify savings is computed
    order_after = next(i for i in c.get("/api/orders", headers=cu).json() if i["code"] == code)
    assert order_after["total_savings"] > 0
    item_after = next(i for i in order_after["items"] if i["id"] == item_with_generic["id"])
    assert item_after["savings"] > 0
    # Original Metformin was 120, generic is 80; qty=4 -> savings = (120-80)*4 = 160
    assert item_after["savings"] == (120 - 80) * 4



