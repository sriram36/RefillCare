import json
import time
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from core.config import AREAS, PAYMENT_MODE, RAZORPAY_WEBHOOK_SECRET
from core.storage import save_encrypted_rx
from core.security import (
    auth, check_consent, check_minor_guardian_consent, need
)
from database.session import ex, log, q
from rules import rule
from services.ocr import demo_png, extract
from services.orderflow import add_item, ingest_ocr_lines, insert_order
from services.routing import settle
from services.payments import (
    create_payment_order,
    generate_test_signature,
    verify_payment_signature,
    verify_webhook_signature,
)

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
def initiate_payment(code: str, u=Depends(auth)):
    need(u, "customer")
    own_order(code, u)
    total_amount = payable_total(code)
    if total_amount <= 0:
        raise HTTPException(422, "Nothing to pay for on this order yet")

    pay_data = create_payment_order(code, total_amount)
    ex(
        "insert into payment_orders(order_code, razorpay_order_id, amount, currency, created_at) values(?, ?, ?, ?, ?)",
        code,
        pay_data["razorpay_order_id"],
        pay_data["amount"],
        pay_data["currency"],
        int(time.time()),
    )
    log(u["name"], "initiate_payment", code)
    return pay_data


def mark_paid(code: str, razorpay_order_id: str, payment_id: str, method: str) -> None:
    ex(
        "update orders set paid = 1, payment = ?, payment_ref = ? where code = ?",
        method,
        payment_id,
        code,
    )
    ex("update payment_orders set status = 'paid' where razorpay_order_id = ?", razorpay_order_id)


@router.post("/orders/{code}/pay/confirm")
def confirm_test_payment(code: str, u=Depends(auth)):
    """Test mode only: the server plays the gateway for the signed-in customer. No money moves."""
    need(u, "customer")
    if PAYMENT_MODE != "test":
        raise HTTPException(404, "Not available")
    own_order(code, u)
    po = q(
        "select * from payment_orders where order_code = ? and status = 'created' order by id desc limit 1",
        code,
        one=True,
    )
    if not po:
        raise HTTPException(409, "Start the payment first")

    payment_id = f"pay_test_{int(time.time() * 1000)}"
    signature = generate_test_signature(po["razorpay_order_id"], payment_id)
    if not verify_payment_signature(po["razorpay_order_id"], payment_id, signature):
        raise HTTPException(500, "Payment signature check failed")

    mark_paid(code, po["razorpay_order_id"], payment_id, "upi_test")
    log(u["name"], f"payment_confirmed_test:{payment_id}", code)
    return {"paid": True, "payment_id": payment_id, "amount_rupees": po["amount"] // 100}


@router.post("/payments/webhook")
async def payment_webhook(request: Request):
    """Real gateway callback. The body must carry a valid HMAC signature; the order is found
    from the payment order we created, never from fields in the payload."""
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    if not verify_webhook_signature(raw_body, signature, RAZORPAY_WEBHOOK_SECRET):
        log("webhook:razorpay", "rejected_bad_signature", "-")
        raise HTTPException(401, "Invalid webhook signature")

    try:
        payload = json.loads(raw_body)
        entity = payload["payload"]["payment"]["entity"]
        order_id = entity["order_id"]
        payment_id = entity["id"]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "Malformed webhook payload")

    if payload.get("event") != "payment.captured":
        return {"status": "ignored"}

    po = q("select * from payment_orders where razorpay_order_id = ?", order_id, one=True)
    if not po:
        return {"status": "ignored"}
    if entity.get("amount") is not None and int(entity["amount"]) != po["amount"]:
        log("webhook:razorpay", f"amount_mismatch:{payment_id}", po["order_code"])
        raise HTTPException(422, "Amount does not match the payment order")

    mark_paid(po["order_code"], order_id, payment_id, "upi_razorpay")
    log("webhook:razorpay", f"paid:{payment_id}", po["order_code"])
    return {"status": "ok", "order_code": po["order_code"]}
