import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")

from database.seed import init
init()

from fastapi.testclient import TestClient
import app as A

c = TestClient(A.app)

def H(phone: str, consent: bool = True) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    token = res.json()["token"]
    headers = {"Authorization": token}
    if consent and res.json().get("user", {}).get("role") == "customer":
        c.post("/api/consent", headers=headers)
    return headers

def test_subscriptions_lifecycle():
    cu = H("9000000001") # Debasish
    ph = H("9000000099") # Anita

    # 1. Create recurring subscription for Metformin
    res = c.post(
        "/api/subscriptions",
        json={"for_name": "Mother", "med_id": 1, "qty": 60, "per_day": 2, "frequency_days": 30},
        headers=cu
    )
    assert res.status_code == 200
    sub_id = res.json()["id"]
    assert res.json()["active"] == 1
    assert "next_refill" in res.json()

    # 2. Get active subscriptions
    subs = c.get("/api/subscriptions", headers=cu).json()
    assert len(subs) >= 1
    assert any(s["id"] == sub_id for s in subs)

    # 3. Trigger subscription engine runner
    run_res = c.post("/api/subscriptions/run", headers=ph)
    assert run_res.status_code == 200
    assert "generated" in run_res.json()

    # 4. Cancel subscription
    del_res = c.delete(f"/api/subscriptions/{sub_id}", headers=cu)
    assert del_res.status_code == 200
    assert del_res.json()["active"] == 0
