import os
import time
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from core.config import STORE
from core.storage import get_decrypted_rx
from core.security import auth, need
from database.session import ex, log, q
from rules import RX_VALID_DAYS, rule
from services.routing import settle

router = APIRouter(prefix="/api", tags=["Pharmacist Verification"])


class Decision(BaseModel):
    action: str
    reason: str = ""
    qty: int | None = None
    prescriber: str = ""
    patient: str = ""


class Hold(BaseModel):
    reason: str


@router.get("/orders/{code}/rx")
def get_rx_image(code: str, u=Depends(auth)):
    need(u, "pharmacist")
    o = q("select * from orders where code = ?", code, one=True)
    if not o or not o["rx_file"]:
        raise HTTPException(404, "No prescription image on file")
    try:
        decrypted_bytes = get_decrypted_rx(o["rx_file"])
    except FileNotFoundError:
        raise HTTPException(404, "Prescription file not found on disk")
    log(u["name"], "view_rx", code)
    return Response(content=decrypted_bytes, media_type="image/png")


@router.get("/orders/{code}/audit")
def get_order_audit(code: str, u=Depends(auth)):
    need(u, "pharmacist")
    o = q("select * from orders where code = ?", code, one=True)
    if not o:
        raise HTTPException(404, "Order not found")
    logs = q(
        "select * from audit where entity = ? or entity like ? order by ts desc",
        code,
        f"%{code}%",
    )
    return logs


@router.post("/items/{iid}/decide")
def decide(iid: int, d: Decision, u=Depends(auth)):
    need(u, "pharmacist")
    item = q("select * from items where id = ?", iid, one=True)
    if not item:
        raise HTTPException(404, "Item not found")

    order = q("select * from orders where code = ?", item["order_code"], one=True)
    if not order:
        raise HTTPException(404, "Order not found")

    if d.action == "reject":
        if not d.reason.strip():
            raise HTTPException(422, "A reason is required to reject")
        ex(
            "update items set status = 'rejected', reason = ? where id = ?",
            d.reason.strip()[:200],
            iid,
        )
    elif d.action == "approve":
        if item["med_id"] is None:
            raise HTTPException(
                422, "Not in catalog. Reject this line or ask for a new prescription"
            )
        qty = d.qty if d.qty is not None else item["qty"]
        if not 1 <= qty <= 50:
            raise HTTPException(422, "Quantity must be 1 to 50")

        # Step 2: Prescription validation for prescription-only (Rx) items
        if rule(item["schedule"])["rx"]:
            today_str = date.today().isoformat()
            store_dir = os.getenv("RX_STORE_PATH", STORE)
            has_order_file = bool(order["rx_file"] and (
                os.path.exists(os.path.join(store_dir, order["rx_file"])) or
                os.path.exists(os.path.join(STORE, order["rx_file"]))
            ))
            valid_record = q(
                "select * from prescriptions where customer_id = ? and profile_name = ? and valid_until >= ? order by valid_until desc limit 1",
                order["customer_id"],
                order["for_name"],
                today_str,
                one=True,
            )
            if not has_order_file and not valid_record:
                raise HTTPException(
                    422,
                    "Prescription-only medicine cannot be approved without an uploaded prescription or a valid prescription record on file",
                )

            # Store or refresh prescription record if order has an uploaded image
            if has_order_file:
                approved_at = today_str
                valid_until = (date.today() + timedelta(days=RX_VALID_DAYS)).isoformat()
                existing_rx = q(
                    "select id from prescriptions where customer_id = ? and profile_name = ?",
                    order["customer_id"],
                    order["for_name"],
                    one=True,
                )
                if existing_rx:
                    ex(
                        "update prescriptions set order_code = ?, rx_file = ?, approved_at = ?, valid_until = ? where id = ?",
                        order["code"],
                        order["rx_file"],
                        approved_at,
                        valid_until,
                        existing_rx["id"],
                    )
                else:
                    ex(
                        "insert into prescriptions(customer_id, profile_name, order_code, rx_file, approved_at, valid_until) values(?, ?, ?, ?, ?, ?)",
                        order["customer_id"],
                        order["for_name"],
                        order["code"],
                        order["rx_file"],
                        approved_at,
                        valid_until,
                    )

        if item["schedule"] == "H1":
            if not d.prescriber.strip() or not d.patient.strip():
                raise HTTPException(
                    422,
                    "H1 medicines need the prescriber and patient name for the register",
                )
            ex(
                "insert into register values(?, ?, ?, ?, ?, ?)",
                item["order_code"],
                iid,
                d.prescriber.strip()[:80],
                d.patient.strip()[:80],
                qty,
                int(time.time()),
            )

        ex(
            "update items set status = 'approved', approved_by = ?, qty = ? where id = ?",
            u["id"],
            qty,
            iid,
        )
    else:
        raise HTTPException(422, "Unknown action")

    log(u["name"], d.action, f"item {iid}")
    settle(item["order_code"])
    return {"ok": True}


@router.post("/orders/{code}/hold")
def hold(code: str, b: Hold, u=Depends(auth)):
    need(u, "pharmacist")
    note = b.reason.strip()[:200] or "Please upload a clearer prescription."
    ex("update orders set status = 'on_hold', note = ? where code = ?", note, code)
    log(u["name"], "ask_reupload", code)
    return {"ok": True}


@router.post("/items/{iid}/offer-generic")
def offer(iid: int, u=Depends(auth)):
    need(u, "pharmacist")
    it = q("select * from items where id = ?", iid, one=True)
    if not it:
        raise HTTPException(404, "Item not found")
    if it["status"] != "approved":
        raise HTTPException(422, "Approve the line before offering a generic")

    g = q("select * from meds where generic_of = ?", it["med_id"], one=True)
    if not g:
        raise HTTPException(422, "No generic on file for this medicine")

    ex("update items set offer = ? where id = ?", g["id"], iid)
    log(u["name"], "offer_generic", f"item {iid}")
    return {"ok": True}
