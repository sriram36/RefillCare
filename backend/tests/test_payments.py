"""The payment is a dummy: it only exists so the screen has something to press. There is no gateway,
no keys and no callback. What still matters is that only the owner can mark their own order paid."""

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")

from database.seed import init
init()

from fastapi.testclient import TestClient
import app as A
from database.session import q

c = TestClient(A.app)


def H(phone: str) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    return {"Authorization": res.json()["token"]}


def order(code: str) -> dict:
    return q("select paid, payment, payment_ref from orders where code = ?", code, one=True)


def test_owner_can_pay_and_gets_a_made_up_reference():
    cu = H("9000000001")
    assert order("RX-50211")["paid"] == 0
    res = c.post("/api/orders/RX-50211/pay", headers=cu)
    assert res.status_code == 200
    body = res.json()
    assert body["paid"] is True and body["amount_rupees"] == 4 * 120
    assert body["reference"].startswith("DEMO")
    o = order("RX-50211")
    assert o["paid"] == 1 and o["payment"] == "upi_test" and o["payment_ref"] == body["reference"]


def test_paying_twice_is_refused():
    cu = H("9000000001")
    assert c.post("/api/orders/RX-50211/pay", headers=cu).status_code == 409


def test_nobody_else_can_mark_my_order_paid():
    assert c.post("/api/orders/RX-50214/pay", headers=H("9000000001")).status_code == 403  # Debasish, Rina's order
    assert c.post("/api/orders/NOPE/pay", headers=H("9000000001")).status_code == 404
    assert c.post("/api/orders/RX-50214/pay", headers=H("9000000099")).status_code == 403  # pharmacist is not a customer
    assert order("RX-50214")["paid"] == 0


def test_an_order_on_hold_cannot_be_paid_yet():
    assert c.post("/api/orders/RX-50219/pay", headers=H("9000000003")).status_code == 409


def test_there_is_no_gateway_left_to_attack():
    # the signed-callback endpoint and its keys are gone, so a stray POST cannot mark anything paid
    res = c.post("/api/payments/webhook", json={"event": "payment.captured"})
    assert res.status_code in (404, 405)
    assert order("RX-50214")["paid"] == 0
    from core import config
    assert not hasattr(config, "RAZORPAY_KEY_SECRET")
    assert not hasattr(config, "RAZORPAY_WEBHOOK_SECRET")
