import time
from core.config import AREAS
from database.session import ex, q
from rules import route


def settle(code: str):
    """Settle an order: if all lines decided, mark verified and route to best store with stock."""
    items = q("select * from items where order_code = ?", code)
    if any(i["status"] == "draft" for i in items):
        return

    ex(
        "update orders set verified_at = ? where code = ? and verified_at is null",
        int(time.time()),
        code,
    )
    live = [i for i in items if i["status"] == "approved"]
    if not live:
        ex("update orders set status = 'rejected' where code = ?", code)
        return

    stores = q("select * from stores")
    for s in stores:
        s["stock"] = {
            r["med_id"]: r["qty"]
            for r in q("select * from stock where store_id = ?", s["id"])
        }

    order_rec = q("select area from orders where code = ?", code, one=True)
    target_area = order_rec.get("area") if order_rec else "Park Street"
    lat, lng = AREAS.get(target_area, AREAS["Park Street"])

    best_store = route(stores, [(i["med_id"], i["qty"]) for i in live], lat, lng)
    ex(
        "update orders set status = 'approved', store_id = ?, note = ? where code = ?",
        best_store["id"] if best_store else None,
        "" if best_store else "No store has every item in stock",
        code,
    )
