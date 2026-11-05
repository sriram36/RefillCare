import csv
import os
import time
from datetime import date, timedelta
from cryptography.fernet import Fernet
from core.config import BASE_DIR, DB, FKEY, STORE
from database.session import db, ex, q, SCHEMA, ensure_schema
from rules import RX_VALID_DAYS
from services.catalog import MEDS
from services.ocr import demo_png


def init():
    actual_db = os.getenv("DB_PATH", DB)
    if os.path.exists(actual_db):
        ensure_schema()
        return

    connection = db()
    connection.executescript(SCHEMA)

    users = [
        (1, "Debasish Ghosh", "9000000001", "customer"),
        (2, "Rina Sen", "9000000002", "customer"),
        (3, "Arif Mondal", "9000000003", "customer"),
        (5, "Store staff, Salt Lake", "9000000081", "store"),
        (6, "Store staff, Behala", "9000000082", "store"),
        (7, "Store staff, Howrah", "9000000083", "store"),
        (9, "Anita Rao (pharmacist)", "9000000099", "pharmacist"),
    ]
    for u in users:
        connection.execute("insert into users(id, name, phone, role) values(?, ?, ?, ?)", u)

    connection.execute("update users set store_id = id - 4 where role = 'store'")
    connection.executemany(
        "insert into profiles(customer_id, name, relation) values(?, ?, ?)",
        [
            (1, "Debasish Ghosh", "Self"),
            (1, "Mother", "Mother"),
            (2, "Rina Sen", "Self"),
            (3, "Arif Mondal", "Self"),
        ],
    )
    connection.executemany("insert into meds(id, name, schedule, price) values(?, ?, ?, ?)", MEDS)
    connection.executemany(
        "insert into meds values(?, ?, ?, ?, ?)",
        [
            (10, "Metformin 500 mg (generic), strip of 15", "H", 80, 1),
            (11, "Telmisartan 40 mg (generic), strip of 10", "H", 190, 2),
        ],
    )
    connection.executemany(
        "insert into stores values(?, ?, ?, ?)",
        [
            (1, "Salt Lake", 22.5867, 88.4171),
            (2, "Behala", 22.4985, 88.3118),
            (3, "Howrah Maidan", 22.5800, 88.3250),
        ],
    )

    stock_csv_path = os.path.join(BASE_DIR, "data", "stock.csv")
    if os.path.exists(stock_csv_path):
        with open(stock_csv_path, encoding="utf-8") as stock_file:
            for r in csv.DictReader(stock_file):
                connection.execute(
                    "insert into stock values(?, ?, ?)",
                    (int(r["store_id"]), int(r["med_id"]), int(r["qty"])),
                )

    now = int(time.time())
    days_ago = lambda n: (date.today() - timedelta(days=n)).isoformat()

    connection.executemany(
        "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created, area) values(?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("RX-50211", 1, "Mother", "packed", 1, None, "", now, "Salt Lake"),
            ("RX-50214", 2, "Rina Sen", "awaiting_pharmacist", 2, None, "", now, "Behala"),
            (
                "RX-50219",
                3,
                "Arif Mondal",
                "on_hold",
                3,
                None,
                "Prescription not readable. Please upload a clearer photo.",
                now,
                "Howrah",
            ),
        ],
    )
    connection.executemany(
        "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("RX-50211", 1, MEDS[0][1], "H", 4, 120, 0.98, "approved", 9, ""),
            ("RX-50214", 2, MEDS[1][1], "H", 3, 285, 0.90, "draft", None, ""),
            ("RX-50219", 3, MEDS[2][1], "H", 1, 190, 0.40, "draft", None, ""),
        ],
    )
    connection.executemany(
        "insert into refills(customer_id, for_name, med_id, qty, per_day, last_filled) values(?, ?, ?, ?, ?, ?)",
        [
            (1, "Mother", 1, 60, 2, days_ago(26)),
            (2, "Rina Sen", 2, 30, 1, days_ago(25)),
            (1, "Mother", 4, 45, 1, days_ago(10)),
        ],
    )
    connection.execute(
        "update orders set created = ?, verified_at = ? where code = 'RX-50211'",
        (now - 900, now - 300),
    )
    connection.execute(
        "insert into prescriptions(customer_id, profile_name, order_code, rx_file, approved_at, valid_until) values(?, ?, ?, ?, ?, ?)",
        (
            1,
            "Mother",
            "RX-50211",
            "RX-50211.enc",
            date.today().isoformat(),
            (date.today() + timedelta(days=RX_VALID_DAYS)).isoformat(),
        ),
    )
    connection.commit()
    connection.close()
    ensure_schema()
    seed_images()


def seed_images():
    # sample orders get a synthetic prescription so the side-by-side screen is never empty
    samples = [("RX-50211", "s50211"), ("RX-50214", "s50214"), ("RX-50219", "blurry")]
    store_dir = os.getenv("RX_STORE_PATH", STORE)
    os.makedirs(store_dir, exist_ok=True)
    for code, kind in samples:
        o = q("select rx_file from orders where code = ?", code, one=True)
        if o and not o["rx_file"]:
            enc = Fernet(FKEY).encrypt(demo_png(kind))
            out_file = os.path.join(store_dir, f"{code}.enc")
            with open(out_file, "wb") as enc_file:
                enc_file.write(enc)
            ex("update orders set rx_file = ? where code = ?", f"{code}.enc", code)


def reset_demo_data():
    """Reset dynamic transaction state back to clean initial demo seed."""
    ensure_schema()
    now = int(time.time())
    days_ago = lambda n: (date.today() - timedelta(days=n)).isoformat()

    ex("delete from payment_orders")
    ex("delete from transfers")
    ex("delete from subscriptions")
    ex("delete from prescriptions")
    ex("delete from register")
    ex("delete from audit")
    ex("delete from refills")
    ex("delete from items")
    ex("delete from orders")

    orders = [
        ("RX-50211", 1, "Mother", "packed", 1, None, "", now, "Salt Lake"),
        ("RX-50214", 2, "Rina Sen", "awaiting_pharmacist", 2, None, "", now, "Behala"),
        ("RX-50219", 3, "Arif Mondal", "on_hold", 3, None, "Prescription not readable. Please upload a clearer photo.", now, "Howrah"),
    ]
    for o in orders:
        ex(
            "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created, area) values(?, ?, ?, ?, ?, ?, ?, ?, ?)",
            *o,
        )

    items = [
        ("RX-50211", 1, MEDS[0][1], "H", 4, 120, 0.98, "approved", 9, ""),
        ("RX-50214", 2, MEDS[1][1], "H", 3, 285, 0.90, "draft", None, ""),
        ("RX-50219", 3, MEDS[2][1], "H", 1, 190, 0.40, "draft", None, ""),
    ]
    for itm in items:
        ex(
            "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            *itm,
        )

    refills = [
        (1, "Mother", 1, 60, 2, days_ago(26)),
        (2, "Rina Sen", 2, 30, 1, days_ago(25)),
        (1, "Mother", 4, 45, 1, days_ago(10)),
    ]
    for rf in refills:
        ex(
            "insert into refills(customer_id, for_name, med_id, qty, per_day, last_filled) values(?, ?, ?, ?, ?, ?)",
            *rf,
        )

    ex("update orders set created = ?, verified_at = ? where code = 'RX-50211'", now - 900, now - 300)
    ex(
        "insert into prescriptions(customer_id, profile_name, order_code, rx_file, approved_at, valid_until) values(?, ?, ?, ?, ?, ?)",
        1,
        "Mother",
        "RX-50211",
        "RX-50211.enc",
        date.today().isoformat(),
        (date.today() + timedelta(days=RX_VALID_DAYS)).isoformat(),
    )
    seed_images()
    return {"status": "ok", "message": "Demo data reset successfully"}
