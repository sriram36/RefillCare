"""Shared order creation: unique order codes and OCR-draft line insertion."""

import time
from datetime import date
from core.storage import get_decrypted_rx, save_encrypted_rx
from database.session import ex, log, q
from rules import packs_needed, rule
from services.catalog import match_medicine

FIRST_CODE = 50220  # codes below this are the sample orders RX-50211, 50214, 50219


def next_order_code() -> str:
    row = q("select max(cast(substr(code, 4) as integer)) n from orders", one=True)
    return f"RX-{max((row or {}).get('n') or 0, FIRST_CODE - 1) + 1}"


def _is_duplicate(err: Exception) -> bool:
    name = type(err).__name__
    return "IntegrityError" in name or "UniqueViolation" in name


def insert_order(
    customer_id: int,
    for_name: str,
    status: str,
    *,
    note: str = "",
    area: str = "Park Street",
    payment: str = "cod",
    paid: int = 0,
    payment_ref: str | None = None,
    rx_file: str | None = None,
) -> str:
    """Insert an order under a fresh code and return it. Retries if two requests pick the same code.

    rx_file may contain '{code}', e.g. '{code}.enc'.
    """
    last_err: Exception | None = None
    for _ in range(6):
        code = next_order_code()
        try:
            ex(
                "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created, payment, paid, area, payment_ref) "
                "values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                code,
                customer_id,
                for_name,
                status,
                None,
                rx_file.format(code=code) if rx_file else None,
                note,
                int(time.time()),
                payment,
                paid,
                area,
                payment_ref,
            )
            return code
        except Exception as e:  # noqa: BLE001 - only duplicate codes are retried
            if not _is_duplicate(e):
                raise
            last_err = e
    raise RuntimeError("Could not allocate an order code") from last_err


def add_item(code: str, med: dict | None, text: str, qty: int, conf: float, status: str = "draft", reason: str = "") -> None:
    sched = med["schedule"] if med else "H"  # unknown medicine is treated as prescription-only
    ex(
        "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) "
        "values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        code,
        med["id"] if med else None,
        med["name"] if med else text + " (not in catalog)",
        sched,
        qty,
        med["price"] if med else 0,
        conf,
        status,
        None,
        reason,
    )


def create_refill_order(customer: dict, for_name: str, med: dict, units: int, actor_note: str = "") -> dict:
    """Order for a refill or subscription. Reuses a valid prescription on file when there is one;
    otherwise the order waits for a new upload. The item is always a DRAFT for the pharmacist."""
    valid_rx = q(
        "select * from prescriptions where customer_id = ? and profile_name = ? and valid_until >= ? order by valid_until desc limit 1",
        customer["id"],
        for_name,
        date.today().isoformat(),
        one=True,
    )
    rx_bytes = None
    if valid_rx and valid_rx["rx_file"]:
        try:
            rx_bytes = get_decrypted_rx(valid_rx["rx_file"])
        except FileNotFoundError:
            rx_bytes = None

    if rx_bytes:
        status = "awaiting_pharmacist"
        note = f"{actor_note}Prescription on file, valid until {valid_rx['valid_until']}".strip()
    else:
        status = "on_hold"
        note = f"{actor_note}Please upload a current prescription".strip()

    code = insert_order(
        customer["id"], for_name, status, note=note, rx_file="{code}.enc" if rx_bytes else None
    )
    if rx_bytes:
        save_encrypted_rx(f"{code}.enc", rx_bytes)
        # the pharmacist still checks it, but reusing it must not restart its validity
        ex("update orders set rx_reused = 1 where code = ?", code)
        log(customer["name"], "reuse_rx_on_file", f"{code}:{valid_rx['order_code']}")

    add_item(code, med, med["name"], packs_needed(units, med["name"]), 1.0)
    return {"code": code, "status": status, "note": note}


def ingest_ocr_lines(code: str, lines: list[dict]) -> None:
    """Turn AI-read lines into DRAFT items. Blocked schedules are rejected on sight, never drafted."""
    for line in lines:
        med, ratio = match_medicine(line["text"])
        conf = round(min(line.get("conf", 1.0), ratio), 2)
        if med and rule(med["schedule"])["blocked"]:
            add_item(code, med, line["text"], 1, conf, "rejected", "Cannot be sold online")
            continue
        digits = "".join(filter(str.isdigit, str(line.get("qty", 1)))) or "1"
        add_item(code, med, line["text"], max(1, min(int(digits), 50)), conf)
