import time
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from core.storage import get_decrypted_rx, rx_exists
from core.security import auth, need
from database.session import ex, log, q
import rules
from rules import rule
from services.orderflow import add_item
from services.routing import FROZEN, pick_store, settle, tell_order

router = APIRouter(prefix="/api", tags=["Pharmacist Verification"])


def editable_order(code: str) -> dict:
    """The order, if a pharmacist may still decide on it. Not after hold, packing or dispatch."""
    order = q("select * from orders where code = ?", code, one=True)
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] == "on_hold":
        raise HTTPException(409, "Order is on hold until the customer sends a new prescription")
    if order["status"] in FROZEN:
        raise HTTPException(409, f"Order is already {order['status']}, so decisions are locked")
    return order


class Decision(BaseModel):
    action: str
    reason: str = ""
    qty: int | None = None
    prescriber: str = ""
    patient: str = ""


class Hold(BaseModel):
    reason: str


class NewLine(BaseModel):
    med_id: int
    qty: int = 1


MANUAL = "Added by pharmacist"  # marks a line the pharmacist typed in, as opposed to one the AI read


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
    kind = "image/jpeg" if decrypted_bytes[:3] == b"\xff\xd8\xff" else "image/png"
    return Response(content=decrypted_bytes, media_type=kind, headers={"Cache-Control": "no-store"})


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

    order = editable_order(item["order_code"])

    if d.action == "reject":
        if not d.reason.strip():
            raise HTTPException(422, "A reason is required to reject")
        ex(
            "update items set status = 'rejected', reason = ? where id = ?",
            d.reason.strip()[:200],
            iid,
        )
    elif d.action == "approve":
        if rule(item["schedule"])["blocked"]:
            raise HTTPException(422, f"Schedule {item['schedule']} medicines cannot be sold online. Reject this line")
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
            has_order_file = rx_exists(order["rx_file"])
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

            # Record validity only for a NEW prescription. A refill that reuses the one on file
            # must not restart the clock, or an old prescription would never expire.
            if has_order_file and not order.get("rx_reused"):
                approved_at = today_str
                valid_until = (date.today() + timedelta(days=rules.RX_VALID_DAYS)).isoformat()
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
            if q("select 1 x from register where item_id = ?", iid, one=True):
                # approving again (for example to edit the quantity) updates the one entry
                ex(
                    "update register set prescriber = ?, patient = ?, qty = ? where item_id = ?",
                    d.prescriber.strip()[:80],
                    d.patient.strip()[:80],
                    qty,
                    iid,
                )
            else:
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


@router.get("/medicines")
def find_medicines(term: str = "", u=Depends(auth)):
    """The catalogue, so a pharmacist can add a line the AI missed or read wrongly."""
    need(u, "pharmacist")
    return q(
        "select id, name, schedule, price from meds where generic_of is null and name like ? order by name limit 20",
        f"%{term.strip()[:40]}%",
    )


@router.post("/orders/{code}/items")
def add_line(code: str, b: NewLine, u=Depends(auth)):
    """Add a medicine to an order. It starts as a draft like every other line, so it still needs approval."""
    need(u, "pharmacist")
    order = editable_order(code)
    med = q("select * from meds where id = ? and generic_of is null", b.med_id, one=True)
    if not med:
        raise HTTPException(404, "Medicine not found")
    if rule(med["schedule"])["blocked"]:
        raise HTTPException(422, f"{med['name']} cannot be sold online")
    if not 1 <= b.qty <= 50:
        raise HTTPException(422, "Quantity must be 1 to 50")

    add_item(code, med, med["name"], b.qty, 1.0, "draft", MANUAL)
    if order["status"] in ("approved", "rejected"):
        # a new unchecked line means the order needs checking again, and must be routed again afterwards
        ex("update orders set status = 'awaiting_pharmacist', store_id = null where code = ?", code)
    log(u["name"], "add_line", f"{code}:{med['name']}")
    return {"ok": True}


@router.post("/orders/{code}/hold")
def hold(code: str, b: Hold, u=Depends(auth)):
    need(u, "pharmacist")
    order = q("select status from orders where code = ?", code, one=True)
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] in FROZEN and order["status"] != "on_hold":
        raise HTTPException(409, f"Order is already {order['status']}")
    note = b.reason.strip()[:200] or "Please upload a clearer prescription."
    ex("update orders set status = 'on_hold', note = ? where code = ?", note, code)
    log(u["name"], "ask_reupload", code)
    tell_order(code, "on_hold")
    return {"ok": True}


@router.post("/items/{iid}/offer-generic")
def offer(iid: int, u=Depends(auth)):
    need(u, "pharmacist")
    it = q("select * from items where id = ?", iid, one=True)
    if not it:
        raise HTTPException(404, "Item not found")
    editable_order(it["order_code"])
    if it["status"] != "approved":
        raise HTTPException(422, "Approve the line before offering a generic")

    g = q("select * from meds where generic_of = ?", it["med_id"], one=True)
    if not g:
        raise HTTPException(422, "No generic on file for this medicine")
    if not pick_store(it["order_code"], [(g["id"], it["qty"])]):
        raise HTTPException(422, "No store has this generic in stock right now")

    ex("update items set offer = ? where id = ?", g["id"], iid)
    log(u["name"], "offer_generic", f"item {iid}")
    return {"ok": True}
