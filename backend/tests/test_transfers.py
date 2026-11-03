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

def test_store_to_store_transfers():
    salt_lake = H("9000000081") # Store 1
    behala = H("9000000082")    # Store 2

    # 1. Store 2 (Behala) requests 10 units of Metformin (id 1) from Store 1 (Salt Lake)
    req_res = c.post(
        "/api/transfers/request",
        json={"to_store_id": 2, "from_store_id": 1, "med_id": 1, "qty": 10},
        headers=behala
    )
    assert req_res.status_code == 200
    transfer_id = req_res.json()["id"]
    assert req_res.json()["status"] == "requested"

    # 2. View pending transfers
    transfers = c.get("/api/transfers", headers=salt_lake).json()
    assert len(transfers) >= 1
    assert any(t["id"] == transfer_id for t in transfers)

    # 3. Store 1 fulfills the transfer
    ful_res = c.post(f"/api/transfers/{transfer_id}/fulfill", headers=salt_lake)
    assert ful_res.status_code == 200
    assert ful_res.json()["status"] == "fulfilled"
