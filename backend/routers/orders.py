import time
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from core.config import AREAS
from core.crypto import save_encrypted_prescription
from core.security import (
    auth, check_consent, check_minor_guardian_consent, need
)
from database.session import ex, log, q
from rules import rule
from services.catalog import match_medicine
from services.ocr import demo_png, extract
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
    raw = await file.read() if file else demo_png(demo)
    if not raw:
        raise HTTPException(400, "Add a prescription photo or pick a demo prescription")
    if len(raw) > 5_000_000:
        raise HTTPException(413, "File is too large (max 5 MB)")
    if not (raw[:4] == b"\x89PNG" or raw[:3] == b"\xff\xd8\xff"):
        raise HTTPException(415, "Upload a PNG or JPEG photo")

    if not q(
        "select 1 x from profiles where customer_id = ? and name = ?",
        u["id"],
        for_name.strip(),
        one=True,
    ):
        raise HTTPException(422, "Choose who this order is for")

    if payment not in ("cod", "upi_test") or area not in AREAS:
        raise HTTPException(422, "Choose a valid payment method and delivery area")

    order_count = q("select count(*) n from orders", one=True)["n"]
    code = f"RX-{50220 + order_count}"
    save_encrypted_prescription(f"{code}.enc", raw)

    res = extract(raw, demo)
    note = ""
    status = "awaiting_pharmacist"
    if res["legible"] is False:
        status, note = "on_hold", "Prescription not readable. Please upload a clearer photo."
    elif res["legible"] is None:
        note = "Automatic reading unavailable. Pharmacist will read it manually."

    ex(
        "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created) values(?, ?, ?, ?, ?, ?, ?, ?)",
        code,
        u["id"],
        for_name.strip()[:60] or u["name"],
        status,
        None,
        f"{code}.enc",
        note,
        int(time.time()),
    )
    payment_ref = f"UTR{int(time.time() * 1000) % 10000000000:010d}" if payment == "upi_test" else None
    ex(
        "update orders set payment = ?, paid = ?, area = ?, payment_ref = ? where code = ?",
        payment,
        1 if payment == "upi_test" else 0,
        area,
        payment_ref,
        code,
    )

    for l in res["lines"]:
        m, ratio = match_medicine(l["text"])
        conf = round(min(l["conf"], ratio), 2)
        sched = m["schedule"] if m else "H"
        if m and rule(sched)["blocked"]:
            ex(
                "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                code,
                m["id"],
                m["name"],
                sched,
                1,
                0,
                conf,
                "rejected",
                None,
                "Cannot be sold online",
            )
            continue

        raw_qty = "".join(filter(str.isdigit, str(l.get("qty", 1)))) or "1"
        parsed_qty = max(1, min(int(raw_qty), 50))
        ex(
            "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            code,
            m["id"] if m else None,
            m["name"] if m else l["text"] + " (not in catalog)",
            sched,
            parsed_qty,
            m["price"] if m else 0,
            conf,
            "draft",
            None,
            "",
        )

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
    o = q("select * from orders where code = ?", code, one=True)
    if not o:
        raise HTTPException(404, "Order not found")
    if o["customer_id"] != u["id"]:
        raise HTTPException(403, "Not your order")
    if o["status"] != "on_hold":
        raise HTTPException(409, "Order is not on hold")

    raw = await file.read() if file else demo_png(demo)
    if not raw:
        raise HTTPException(400, "Add a prescription photo or pick a demo prescription")
    if len(raw) > 5_000_000:
        raise HTTPException(413, "File is too large (max 5 MB)")
    if not (raw[:4] == b"\x89PNG" or raw[:3] == b"\xff\xd8\xff"):
        raise HTTPException(415, "Upload a PNG or JPEG photo")

    save_encrypted_prescription(f"{code}.enc", raw)
    ex("delete from items where order_code = ?", code)

    res = extract(raw, demo)
    note = ""
    status = "awaiting_pharmacist"
    if res["legible"] is False:
        status, note = "on_hold", "Prescription not readable. Please upload a clearer photo."
    elif res["legible"] is None:
        note = "Automatic reading unavailable. Pharmacist will read it manually."

    ex(
        "update orders set status = ?, rx_file = ?, note = ? where code = ?",
        status,
        f"{code}.enc",
        note,
        code,
    )

    for l in res["lines"]:
        m, ratio = match_medicine(l["text"])
        conf = round(min(l["conf"], ratio), 2)
        sched = m["schedule"] if m else "H"
        if m and rule(sched)["blocked"]:
            ex(
                "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                code,
                m["id"],
                m["name"],
                sched,
                1,
                0,
                conf,
                "rejected",
                None,
                "Cannot be sold online",
            )
            continue

        raw_qty = "".join(filter(str.isdigit, str(l.get("qty", 1)))) or "1"
        parsed_qty = max(1, min(int(raw_qty), 50))
        ex(
            "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            code,
            m["id"] if m else None,
            m["name"] if m else l["text"] + " (not in catalog)",
            sched,
            parsed_qty,
            m["price"] if m else 0,
            conf,
            "draft",
            None,
            "",
        )

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

    order_count = q("select count(*) n from orders", one=True)["n"]
    code = f"RX-{50220 + order_count}"

    ex(
        "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created) values(?, ?, ?, ?, ?, ?, ?, ?)",
        code,
        u["id"],
        b.for_name.strip(),
        "approved",
        None,
        None,
        "",
        int(time.time()),
    )
    payment_ref = f"UTR{int(time.time() * 1000) % 10000000000:010d}" if b.payment == "upi_test" else None
    ex(
        "update orders set payment = ?, paid = ?, area = ?, payment_ref = ? where code = ?",
        b.payment,
        1 if b.payment == "upi_test" else 0,
        b.area,
        payment_ref,
        code,
    )

    for m, qty in picked:
        ex(
            "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            code,
            m["id"],
            m["name"],
            m["schedule"],
            qty,
            m["price"],
            1.0,
            "approved",
            None,
            "",
        )

    settle(code)
    # no pharmacist step, so it stays out of verification times:
    ex("update orders set verified_at = null where code = ?", code)

    log(u["name"], "cart_order", code)
    return {"code": code}
