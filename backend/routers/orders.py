import time
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from core.config import AREAS
from core.storage import save_encrypted_rx
from core.security import (
    auth, check_consent, check_minor_guardian_consent, need
)
from database.session import ex, log, q
from rules import rule
from services.ocr import demo_png, extract
from services.orderflow import add_item, ingest_ocr_lines, insert_order
from services.routing import settle

router = APIRouter(prefix="/api", tags=["Orders & Cart"])


def full_order(o: dict) -> dict:
    o["items"] = q("select * from items where order_code = ?", o["code"])
    total_savings = 0
    for i in o["items"]:
        i["generic"] = (
            q(
                "select name, price from meds where generic_of = ?",
                i["med_id"],
                one=True,
            )
            if i["med_id"]
            else None
        )
        i["offer_med"] = (
            q("select name, price from meds where id = ?", i["offer"], one=True)
            if i["offer"]
            else None
        )
        if i.get("consent") == 1 and i.get("original_price") and i["original_price"] > i["price"]:
            i["savings"] = (i["original_price"] - i["price"]) * i["qty"]
            total_savings += i["savings"]
        else:
            i["savings"] = 0
    o["total_savings"] = total_savings
    store_record = q("select name from stores where id = ?", o["store_id"], one=True)
    o["store"] = store_record["name"] if store_record else None
    return o


def own_order(code: str, u: dict) -> dict:
    """Fetch an order that belongs to the signed-in customer, or fail."""
    o = q("select * from orders where code = ?", code, one=True)
    if not o:
        raise HTTPException(404, "Order not found")
    if o["customer_id"] != u["id"]:
        raise HTTPException(403, "Not your order")
    return o


async def read_rx_upload(file: UploadFile | None, demo: str) -> bytes:
    raw = await file.read() if file else demo_png(demo)
    if not raw:
        raise HTTPException(400, "Add a prescription photo or pick a demo prescription")
    if len(raw) > 5_000_000:
        raise HTTPException(413, "File is too large (max 5 MB)")
    if not (raw[:4] == b"\x89PNG" or raw[:3] == b"\xff\xd8\xff"):
        raise HTTPException(415, "Upload a PNG or JPEG photo")
    return raw


def read_result(res: dict) -> tuple[str, str]:
    """Order status and note from the AI reading. The AI only drafts: unreadable means ask again."""
    if res["legible"] is False:
        return "on_hold", "Prescription not readable. Please upload a clearer photo."
    if res["legible"] is None:
        return "awaiting_pharmacist", "Automatic reading unavailable. Pharmacist will read it manually."
    return "awaiting_pharmacist", ""


@router.get("/orders")
def get_orders(u=Depends(auth)):
    if u["role"] == "customer":
        rows = q(
            "select * from orders where customer_id = ? order by created desc, code desc",
            u["id"],
        )
    elif u["role"] == "store":
        rows = q(
            "select * from orders where store_id = ? and status in ('awaiting_pharmacist', 'approved', 'packed', 'dispatched') order by created desc, code desc",
            u["store_id"],
        )
    else:
        rows = q("select * from orders order by created desc, code desc")
    return [full_order(o) for o in rows]


@router.post("/orders")
async def new_order(
    for_name: str = Form(...),
    demo: str = Form(""),
    payment: str = Form("cod"),
    area: str = Form("Park Street"),
    file: UploadFile = File(None),
    u=Depends(auth),
):
    need(u, "customer")
    check_consent(u)
    check_minor_guardian_consent(u, for_name)

    raw = await read_rx_upload(file, demo)

    if not q(
        "select 1 x from profiles where customer_id = ? and name = ?",
        u["id"],
        for_name.strip(),
        one=True,
    ):
        raise HTTPException(422, "Choose who this order is for")

    if payment not in ("cod", "upi_test") or area not in AREAS:
        raise HTTPException(422, "Choose a valid payment method and delivery area")

    res = extract(raw, demo)
    status, note = read_result(res)
    code = insert_order(
        u["id"],
        for_name.strip()[:60] or u["name"],
        status,
        note=note,
        area=area,
        payment=payment,
        paid=1 if payment == "upi_test" else 0,
        payment_ref=f"UTR{int(time.time() * 1000) % 10000000000:010d}" if payment == "upi_test" else None,
        rx_file="{code}.enc",
    )
    try:
        save_encrypted_rx(f"{code}.enc", raw)
    except Exception:
        ex("delete from orders where code = ?", code)  # no order without its prescription
        raise

    ingest_ocr_lines(code, res["lines"])
    log(u["name"], "upload_rx", code)
    return {"code": code}


@router.post("/orders/{code}/reupload")
async def reupload_rx(
    code: str,
    demo: str = Form(""),
    file: UploadFile = File(None),
    u=Depends(auth),
):
    need(u, "customer")
    check_consent(u)
    o = own_order(code, u)
    if o["status"] != "on_hold":
        raise HTTPException(409, "Order is not on hold")

    raw = await read_rx_upload(file, demo)
    save_encrypted_rx(f"{code}.enc", raw)
    ex("delete from items where order_code = ?", code)

    res = extract(raw, demo)
    status, note = read_result(res)
    ex(
        "update orders set status = ?, rx_file = ?, note = ? where code = ?",
        status,
        f"{code}.enc",
        note,
        code,
    )
    ingest_ocr_lines(code, res["lines"])
    log(u["name"], "reupload_rx", code)
    return {"ok": True, "status": status}


class CartLine(BaseModel):
    med_id: int
    qty: int


class CartOrder(BaseModel):
    lines: list[CartLine]
    for_name: str
    payment: str = "cod"
    area: str = "Park Street"


@router.post("/cart")
def order_cart(b: CartOrder, u=Depends(auth)):
    need(u, "customer")
    check_consent(u)
    check_minor_guardian_consent(u, b.for_name)
    if not 1 <= len(b.lines) <= 10:
        raise HTTPException(422, "Add 1 to 10 items")

    if not q(
        "select 1 x from profiles where customer_id = ? and name = ?",
        u["id"],
        b.for_name.strip(),
        one=True,
    ):
        raise HTTPException(422, "Choose who this order is for")

    if b.payment not in ("cod", "upi_test") or b.area not in AREAS:
        raise HTTPException(422, "Choose a valid payment method and delivery area")

    picked = []
    for line in b.lines:
        m = q("select * from meds where id = ? and generic_of is null", line.med_id, one=True)
        if not m:
            raise HTTPException(404, "Medicine not found")
        if rule(m["schedule"])["blocked"]:
            raise HTTPException(422, f"{m['name']} cannot be sold online")
        if rule(m["schedule"])["rx"]:
            raise HTTPException(
                422,
                f"{m['name']} needs a prescription. Upload one for pharmacist approval",
            )
        if not 1 <= line.qty <= 20:
            raise HTTPException(422, "Quantity must be 1 to 20")
        picked.append((m, line.qty))

    code = insert_order(
        u["id"],
        b.for_name.strip(),
        "approved",
        area=b.area,
        payment=b.payment,
        paid=1 if b.payment == "upi_test" else 0,
        payment_ref=f"UTR{int(time.time() * 1000) % 10000000000:010d}" if b.payment == "upi_test" else None,
    )
    for m, qty in picked:
        add_item(code, m, m["name"], qty, 1.0, "approved")

    settle(code)
    # no pharmacist step, so it stays out of verification times:
    ex("update orders set verified_at = null where code = ?", code)

    log(u["name"], "cart_order", code)
    return {"code": code}


def payable_total(code: str) -> int:
    items = q("select price, qty from items where order_code = ? and status != 'rejected'", code)
    return sum(i["price"] * i["qty"] for i in items)


@router.post("/orders/{code}/pay")
def pay_demo(code: str, u=Depends(auth)):
    """A dummy payment, for the screen only. There is no gateway: no keys, no callback, no money.
    It marks the customer's own order as paid and gives back a made-up reference."""
    need(u, "customer")
    o = own_order(code, u)
    if o["status"] in ("rejected", "on_hold"):
        raise HTTPException(409, "This order cannot be paid yet")
    if o["paid"] == 1:
        raise HTTPException(409, "This order is already paid")
    total = payable_total(code)
    if total <= 0:
        raise HTTPException(422, "Nothing to pay for on this order yet")

    ref = f"DEMO{int(time.time() * 1000) % 100000000:08d}"
    ex("update orders set paid = 1, payment = 'upi_test', payment_ref = ? where code = ?", ref, code)
    log(u["name"], "demo_payment", code)
    return {"paid": True, "amount_rupees": total, "reference": ref}
