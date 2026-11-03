from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.security import auth, need
from database.session import ex, log, q
from rules import can_dispatch

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
