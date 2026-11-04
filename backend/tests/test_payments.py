import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")

from database.seed import init
init()

from fastapi.testclient import TestClient
import app as A
from services import payments

c = TestClient(A.app)

def H(phone: str) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    return {"Authorization": res.json()["token"]}

def test_razorpay_payment_flow():
    cu = H("9000000001")

    # 1. Create payment order for order RX-50211
    res = c.post("/api/orders/RX-50211/pay", headers=cu)
    assert res.status_code == 200
    data = res.json()
    assert "razorpay_order_id" in data
    assert data["amount"] > 0
    assert data["currency"] == "INR"

    # 2. Verify signature verification utility
    sig = payments.generate_test_signature(data["razorpay_order_id"], "pay_test_9999")
    valid = payments.verify_payment_signature(data["razorpay_order_id"], "pay_test_9999", sig)
    assert valid is True

    # 3. Simulate webhook payment capture
    hook_res = c.post(
        "/api/payments/webhook",
        json={
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_9999",
                        "order_id": data["razorpay_order_id"],
                        "amount": data["amount"],
                        "status": "captured",
                        "notes": {"order_code": "RX-50211"}
                    }
                }
            }
        }
    )
    assert hook_res.status_code == 200
    assert hook_res.json()["status"] == "ok"


def test_razorpay_secret_fallback_random():
    from core import config
    assert isinstance(config.RAZORPAY_KEY_SECRET, str)
    assert len(config.RAZORPAY_KEY_SECRET) >= 32
    assert config.RAZORPAY_KEY_SECRET != "refillcare_secret_demo"

    sig = payments.generate_test_signature("order_test_abc", "pay_test_xyz")
    assert payments.verify_payment_signature("order_test_abc", "pay_test_xyz", sig) is True
    assert payments.verify_payment_signature("order_test_abc", "pay_test_xyz", "invalid_sig") is False

