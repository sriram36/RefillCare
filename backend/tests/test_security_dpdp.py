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

def H(phone: str) -> dict:
    res = c.post("/api/login", json={"phone": phone, "otp": "123456"})
    return {"Authorization": res.json()["token"]}

def test_owasp_security_headers():
    res = c.get("/")
    assert res.status_code == 200
    headers = res.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert "strict-origin" in headers.get("Referrer-Policy", "")

def test_dpdp_right_to_erasure():
    # Customer 2 (Rina Sen) requests erasure
    cu2 = H("9000000002")
    res = c.post("/api/me/forget", headers=cu2)
    assert res.status_code == 200
    assert res.json()["status"] == "erased"

    # User token is now revoked
    res_after = c.get("/api/orders", headers=cu2)
    assert res_after.status_code == 401
