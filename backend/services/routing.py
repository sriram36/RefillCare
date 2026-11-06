import time
from core.config import AREAS
from database.session import ex, exc, q
from rules import route
from services.messages import order_update
from services.notifications import tell

# Once an order is on hold or past packing, a late consent or decision must not re-route it.
FROZEN = ("on_hold", "packed", "dispatched", "delivered")


def pick_store(code: str, lines: list[tuple[int, int]]) -> dict | None:
    """Nearest store that holds every (med_id, qty) line, measured from the order's delivery area."""
    stores = q("select * from stores")
    for s in stores:
        s["stock"] = {
            r["med_id"]: r["qty"]
            for r in q("select * from stock where store_id = ?", s["id"])
        }
    order_rec = q("select area from orders where code = ?", code, one=True)
    target_area = (order_rec or {}).get("area") or "Park Street"
    lat, lng = AREAS.get(target_area, AREAS["Park Street"])
    return route(stores, lines, lat, lng)


def shortfall(code: str, lines: list[tuple[int, int]]) -> list[str]:
    """Names of lines that no single store can cover on its own. Used to explain 'no store' to staff."""
    stores = q("select id from stores")
    missing = []
    for med_id, need_qty in lines:
        have = any(
            (q("select qty from stock where store_id = ? and med_id = ?", s["id"], med_id, one=True) or {}).get("qty", 0)
            >= need_qty
            for s in stores
        )
        if not have:
            med = q("select name from meds where id = ?", med_id, one=True)
            missing.append(med["name"] if med else f"medicine #{med_id}")
    return missing


def settle(code: str):
    """Settle an order: if all lines decided, mark verified and route to best store with stock."""
    order = q("select status from orders where code = ?", code, one=True)
    if not order or order["status"] in FROZEN:
        return

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
        tell_order(code, "rejected")
        return

    lines = [(i["med_id"], i["qty"]) for i in live]
    best_store = pick_store(code, lines)
    note = ""
    if not best_store:
        gaps = shortfall(code, lines)
        note = (
            "No single store has every item. Short of: " + ", ".join(gaps)
            if gaps
            else "No single store has every item together. Ask a store to transfer stock."
        )
    ex(
        "update orders set status = 'approved', store_id = ?, note = ? where code = ?",
        best_store["id"] if best_store else None,
        note,
        code,
    )
    tell_order(code, "approved", best_store["name"] if best_store else "")


def tell_order(code: str, event: str, store: str = "", reason: str = ""):
    """Tell the customer, in their language, that their order moved on."""
    order = q("select customer_id from orders where code = ?", code, one=True)
    if order:
        tell(order["customer_id"], f"order:{code}:{event}", lambda lang: order_update(lang, event, code, store, reason))


def reserve_stock(store_id: int, lines: list[tuple[int, int]]) -> str | None:
    """Take stock for a packed order. All lines or none: returns the name of the short line, else None."""
    taken: list[tuple[int, int]] = []
    for med_id, qty in lines:
        changed = exc(
            "update stock set qty = qty - ? where store_id = ? and med_id = ? and qty >= ?",
            qty, store_id, med_id, qty,
        )
        if not changed:
            for m, n in taken:  # put back what we already took
                ex("update stock set qty = qty + ? where store_id = ? and med_id = ?", n, store_id, m)
            med = q("select name from meds where id = ?", med_id, one=True)
            return med["name"] if med else f"medicine #{med_id}"
        taken.append((med_id, qty))
    return None
