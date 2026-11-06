import hashlib
import hmac
import json
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
from routers import orders as orders_router
from services import payments

c = TestClient(A.app)
SECRET = "whsec_test_only"


def H(phone: str) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    return {"Authorization": res.json()["token"]}


def paid(code: str) -> int:
    return q("select paid from orders where code = ?", code, one=True)["paid"]


def signed_post(body: dict, secret: str = SECRET):
    raw = json.dumps(body).encode()
    sig = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return c.post(
        "/api/payments/webhook",
        content=raw,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"},
    )


def captured(order_id: str, amount: int, pay_id: str = "pay_1") -> dict:
    return {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": pay_id, "order_id": order_id, "amount": amount}}},
    }


def test_owner_can_pay_in_test_mode():
    cu = H("9000000001")
    res = c.post("/api/orders/RX-50211/pay", headers=cu)
    assert res.status_code == 200
    data = res.json()
    assert data["amount"] == 4 * 120 * 100 and data["currency"] == "INR"

    assert paid("RX-50211") == 0
    done = c.post("/api/orders/RX-50211/pay/confirm", headers=cu)
    assert done.status_code == 200 and done.json()["paid"] is True
    assert paid("RX-50211") == 1
    assert q("select payment from orders where code = 'RX-50211'", one=True)["payment"] == "upi_test"


def test_confirm_needs_started_payment_and_owner():
    cu, rina = H("9000000001"), H("9000000002")
    assert c.post("/api/orders/RX-50214/pay/confirm", headers=rina).status_code == 409  # never started
    c.post("/api/orders/RX-50214/pay", headers=rina)
    assert c.post("/api/orders/RX-50214/pay/confirm", headers=cu).status_code == 403  # someone else's order
    assert paid("RX-50214") == 0


def test_other_customer_cannot_start_payment_for_my_order():
    assert c.post("/api/orders/RX-50214/pay", headers=H("9000000001")).status_code == 403
    assert c.post("/api/orders/NOPE/pay", headers=H("9000000001")).status_code == 404


def test_webhook_rejects_unsigned_and_wrongly_signed(monkeypatch):
    monkeypatch.setattr(orders_router, "RAZORPAY_WEBHOOK_SECRET", SECRET)
    rina = H("9000000002")
    po = c.post("/api/orders/RX-50214/pay", headers=rina).json()
    body = captured(po["razorpay_order_id"], po["amount"])

    # the old attack: anyone posts "paid" with no signature
    assert c.post("/api/payments/webhook", json=body).status_code == 401
    assert signed_post(body, secret="attacker-guess").status_code == 401
    assert paid("RX-50214") == 0


def test_webhook_closed_when_no_secret_is_configured(monkeypatch):
    monkeypatch.setattr(orders_router, "RAZORPAY_WEBHOOK_SECRET", None)
    raw = b"{}"
    sig = hmac.new(b"", raw, hashlib.sha256).hexdigest()
    res = c.post("/api/payments/webhook", content=raw, headers={"X-Razorpay-Signature": sig})
    assert res.status_code == 401


def test_signed_webhook_marks_paid_from_our_own_record(monkeypatch):
    monkeypatch.setattr(orders_router, "RAZORPAY_WEBHOOK_SECRET", SECRET)
    rina = H("9000000002")
    po = c.post("/api/orders/RX-50214/pay", headers=rina).json()

    # a wrong amount is refused even with a valid signature
    assert signed_post(captured(po["razorpay_order_id"], po["amount"] - 100)).status_code == 422
    assert paid("RX-50214") == 0

    # the order is found from OUR payment order, never from fields the caller supplies
    body = captured(po["razorpay_order_id"], po["amount"], "pay_real")
    body["payload"]["payment"]["entity"]["notes"] = {"order_code": "RX-50219"}
    ok = signed_post(body)
    assert ok.status_code == 200 and ok.json()["order_code"] == "RX-50214"
    assert paid("RX-50214") == 1 and paid("RX-50219") == 0

    # unknown gateway orders and other events are ignored, not trusted
    assert signed_post(captured("order_unknown", 100)).json()["status"] == "ignored"
    assert signed_post({"event": "payment.failed", "payload": {"payment": {"entity": {"id": "x", "order_id": "y"}}}}).json()["status"] == "ignored"


def test_signature_helpers():
    sig = payments.generate_test_signature("order_test_abc", "pay_test_xyz")
    assert payments.verify_payment_signature("order_test_abc", "pay_test_xyz", sig) is True
    assert payments.verify_payment_signature("order_test_abc", "pay_test_xyz", "invalid_sig") is False
    assert payments.verify_payment_signature("order_test_abc", "pay_test_xyz", "") is False


def test_razorpay_secret_fallback_random():
    from core import config
    assert isinstance(config.RAZORPAY_KEY_SECRET, str)
    assert len(config.RAZORPAY_KEY_SECRET) >= 32
