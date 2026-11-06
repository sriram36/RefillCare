import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.security import auth, need
from database.session import ex, exc, log, q
from rules import can_dispatch
from services.routing import reserve_stock

router = APIRouter(prefix="/api", tags=["Store Fulfillment"])


def advance(code: str, frm: str, to: str, u: dict, inv: str | None = None):
    need(u, "store")
    order = q("select * from orders where code = ?", code, one=True)
    if not order:
        raise HTTPException(404, "Order not found")

    items = q("select * from items where order_code = ?", code)
    for i in items:
        i["registered"] = bool(q("select 1 x from register where item_id = ?", i["id"]))

    ok, why = can_dispatch(items)
    if not ok:
        log(u["name"], f"blocked_{to}", code)
        raise HTTPException(403, {"code": "APPROVAL_REQUIRED", "message": why})

    if order["store_id"] != u["store_id"]:
        raise HTTPException(403, "This order belongs to another store")
    if order["status"] != frm or not order["store_id"]:
        raise HTTPException(409, f"Order must be {frm} and routed to a store first")

    if to == "packed":
        lines = [(i["med_id"], i["qty"]) for i in items if i["status"] == "approved"]
        short = reserve_stock(order["store_id"], lines)
        if short:
            log(u["name"], "blocked_packed_no_stock", code)
            raise HTTPException(409, f"Not enough stock of {short}. Ask for a transfer or let the pharmacist re-route")

    ex(
        "update orders set status = ?, invoice_no = coalesce(?, invoice_no) where code = ?",
        to,
        inv,
        code,
    )
    log(u["name"], to, code)
    return {"ok": True}


class Pack(BaseModel):
    invoice: str


@router.post("/orders/{code}/pack")
def pack(code: str, b: Pack, u=Depends(auth)):
    if not b.invoice.strip():
        raise HTTPException(422, "Enter the store invoice number")
    return advance(code, "approved", "packed", u, b.invoice.strip()[:30])


class DispatchReq(BaseModel):
    partner: str | None = None


@router.post("/orders/{code}/dispatch")
def dispatch(code: str, b: DispatchReq | None = None, u=Depends(auth)):
    partner = (b.partner if b and b.partner else "Local Express Delivery").strip()[:60]
    res = advance(code, "packed", "dispatched", u)
    ex("update orders set delivery_partner = ? where code = ?", partner, code)
    return {**res, "delivery_partner": partner}


class TransferRequest(BaseModel):
    to_store_id: int | None = None
    from_store_id: int = 1
    med_id: int
    qty: int


@router.get("/transfers")
def get_transfers(u=Depends(auth)):
    if u["role"] == "store":
        rows = q(
            """
            select t.*, m.name as med_name, s1.name as from_store, s2.name as to_store
            from transfers t
            join meds m on t.med_id = m.id
            left join stores s1 on t.from_store_id = s1.id
            left join stores s2 on t.to_store_id = s2.id
            where t.from_store_id = ? or t.to_store_id = ?
            order by t.requested_at desc
            """,
            u["store_id"],
            u["store_id"],
        )
    else:
        rows = q(
            """
            select t.*, m.name as med_name, s1.name as from_store, s2.name as to_store
            from transfers t
            join meds m on t.med_id = m.id
            left join stores s1 on t.from_store_id = s1.id
            left join stores s2 on t.to_store_id = s2.id
            order by t.requested_at desc
            """
        )
    return rows


@router.post("/transfers/request")
def request_transfer(b: TransferRequest, u=Depends(auth)):
    need(u, "store")
    to_store = b.to_store_id or u["store_id"]
    from_store = b.from_store_id
    if to_store == from_store:
        raise HTTPException(400, "Cannot transfer stock to the same store")
    if b.qty <= 0:
        raise HTTPException(400, "Quantity must be positive")
    if not q("select 1 x from meds where id = ?", b.med_id, one=True):
        raise HTTPException(404, "Medicine not found")
    for sid in (from_store, to_store):
        if not q("select 1 x from stores where id = ?", sid, one=True):
            raise HTTPException(404, f"Store {sid} not found")

    now = int(time.time())
    tid = ex(
        "insert into transfers(from_store_id, to_store_id, med_id, qty, status, requested_at) values(?, ?, ?, ?, 'requested', ?)",
        from_store,
        to_store,
        b.med_id,
        b.qty,
        now,
    )
    log(u["name"], f"request_transfer:{b.qty}x{b.med_id}", f"transfer-{tid}")
    return {"id": tid, "status": "requested", "qty": b.qty}


@router.post("/transfers/{tid}/fulfill")
def fulfill_transfer(tid: int, u=Depends(auth)):
    need(u, "store")
    tr = q("select * from transfers where id = ?", tid, one=True)
    if not tr:
        raise HTTPException(404, "Transfer record not found")
    if tr["status"] == "fulfilled":
        raise HTTPException(409, "Transfer is already fulfilled")
    if u["store_id"] != tr["from_store_id"]:
        raise HTTPException(403, "Only the store sending the stock can fulfil this transfer")

    # claim the transfer first so a double tap cannot move stock twice
    if not exc("update transfers set status = 'fulfilled', fulfilled_at = ? where id = ? and status != 'fulfilled'", int(time.time()), tid):
        raise HTTPException(409, "Transfer is already fulfilled")
    if not exc(
        "update stock set qty = qty - ? where store_id = ? and med_id = ? and qty >= ?",
        tr["qty"], tr["from_store_id"], tr["med_id"], tr["qty"],
    ):
        ex("update transfers set status = 'requested', fulfilled_at = null where id = ?", tid)
        raise HTTPException(409, "Not enough stock here to send this transfer")
    if not exc(
        "update stock set qty = qty + ? where store_id = ? and med_id = ?",
        tr["qty"], tr["to_store_id"], tr["med_id"],
    ):
        ex("insert into stock(store_id, med_id, qty) values(?, ?, ?)", tr["to_store_id"], tr["med_id"], tr["qty"])
    log(u["name"], "fulfill_transfer", f"transfer-{tid}")
    return {"id": tid, "status": "fulfilled"}
