import base64
import csv
import difflib
import hashlib
import hmac
import io
import json
import os
import shutil
import sqlite3
import statistics
import time
from datetime import date, timedelta

from cryptography.fernet import Fernet
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw, ImageFilter
from pydantic import BaseModel

from rules import RX_VALID_DAYS, can_dispatch, route, rule

# Base directory of the backend module
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Auto-load .env file from backend directory if present
_env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(_env_path):
    with open(_env_path, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                _k, _v = _k.strip(), _v.strip().strip("'\"")
                if _k and _k not in os.environ:
                    os.environ[_k] = _v

DB = os.getenv("DB_PATH", os.path.join(BASE_DIR, "pharmacy.db"))
SECRET = os.getenv("APP_SECRET", "dev-only-secret")
FKEY = os.getenv("RX_ENC_KEY") or base64.urlsafe_b64encode(
    hashlib.sha256(SECRET.encode()).digest()
)
STORE = os.getenv("RX_STORE_PATH", os.path.join(BASE_DIR, "rx_store"))
os.makedirs(STORE, exist_ok=True)

app = FastAPI(title="RefillCare API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Detect compiled Next.js frontend directory
FRONTEND_DIST = os.path.join(BASE_DIR, "out")
if not os.path.exists(FRONTEND_DIST):
    FRONTEND_DIST = os.path.join(os.path.dirname(BASE_DIR), "frontend", "out")

if os.path.exists(FRONTEND_DIST):
    next_static = os.path.join(FRONTEND_DIST, "_next")
    if os.path.exists(next_static):
        app.mount("/_next", StaticFiles(directory=next_static), name="next_static")

AREAS = {
    "Park Street": (22.5535, 88.3520),
    "Salt Lake": (22.5867, 88.4171),
    "Behala": (22.4985, 88.3118),
    "Howrah": (22.5800, 88.3250),
}  # sample coordinates

SCHEMA = """
create table users(id integer primary key, name, phone unique, role, store_id, consent_at, token_ver default 1);
create table meds(id integer primary key, name, schedule, price, generic_of);
create table stores(id integer primary key, name, lat, lng);
create table stock(store_id, med_id, qty, primary key(store_id, med_id));
create table orders(code primary key, customer_id, for_name, status, store_id, rx_file, note, created, verified_at, invoice_no, payment default 'cod', paid default 0, area default 'Park Street', payment_ref, delivery_partner);
create table items(id integer primary key, order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason, offer, consent, original_price);
create table refills(id integer primary key, customer_id, for_name, med_id, qty, per_day, last_filled);
create table audit(ts, actor, action, entity);
create table profiles(id integer primary key, customer_id, name, relation, is_minor default 0, guardian_consent default 0);
create table notes(customer_id, text, ts, day);
create table register(order_code, item_id, prescriber, patient, qty, ts);
create table prescriptions(id integer primary key, customer_id, profile_name, order_code, rx_file, approved_at, valid_until);
"""


def db():
    connection = sqlite3.connect(DB)
    connection.row_factory = sqlite3.Row
    return connection


def q(sql: str, *args, one: bool = False):
    # Single-connection-per-call: acceptable for single-worker SQLite.
    # Use explicit transactions for multi-statement atomicity in production.
    connection = db()
    cursor = connection.execute(sql, args)
    rows = [dict(row) for row in cursor]
    connection.close()
    return (rows[0] if rows else None) if one else rows


def ex(sql: str, *args):
    connection = db()
    cursor = connection.execute(sql, args)
    connection.commit()
    last_id = cursor.lastrowid
    connection.close()
    return last_id


def log(actor: str, action: str, entity: str):
    ex(
        "insert into audit values(?, ?, ?, ?)",
        int(time.time()),
        actor,
        action,
        entity,
    )


MEDS = [
    (1, "Metformin 500 mg, strip of 15", "H", 120),
    (2, "Telmisartan 40 mg, strip of 10", "H", 285),
    (3, "Levothyroxine 50 mcg, bottle of 100", "H", 190),
    (4, "Amlodipine 5 mg, strip of 15", "H", 60),
    (5, "Glimepiride 1 mg, strip of 10", "H", 85),
    (6, "Alprazolam 0.25 mg, strip of 10", "H1", 40),
    (7, "Paracetamol 500 mg, strip of 10", "OTC", 30),
    (8, "Demo Restricted-X 10 mg, strip of 10", "X", 0),
    (9, "Demo Narcotic 5 mg, strip of 10", "NARC", 0),
]


def init():
    if os.path.exists(DB):
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
    with open(stock_csv_path, encoding="utf-8") as stock_file:
        for r in csv.DictReader(stock_file):
            connection.execute(
                "insert into stock values(?, ?, ?)",
                (int(r["store_id"]), int(r["med_id"]), int(r["qty"])),
            )

    now = int(time.time())
    days_ago = lambda n: (date.today() - timedelta(days=n)).isoformat()

    connection.executemany(
        "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created) values(?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("RX-50211", 1, "Mother", "packed", 1, None, "", now),
            ("RX-50214", 2, "Rina Sen", "awaiting_pharmacist", 2, None, "", now),
            (
                "RX-50219",
                3,
                "Arif Mondal",
                "on_hold",
                3,
                None,
                "Prescription not readable. Please upload a clearer photo.",
                now,
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


def ensure_schema():
    connection = db()
    connection.execute(
        "create table if not exists prescriptions(id integer primary key, customer_id, profile_name, order_code, rx_file, approved_at, valid_until)"
    )
    for col, ddl in [
        ("consent_at", "alter table users add column consent_at integer"),
        ("token_ver", "alter table users add column token_ver integer default 1"),
        ("is_minor", "alter table profiles add column is_minor integer default 0"),
        ("guardian_consent", "alter table profiles add column guardian_consent integer default 0"),
        ("payment_ref", "alter table orders add column payment_ref text"),
        ("delivery_partner", "alter table orders add column delivery_partner text"),
        ("original_price", "alter table items add column original_price integer"),
    ]:
        try:
            connection.execute(ddl)
        except sqlite3.OperationalError:
            pass
    connection.commit()
    connection.close()


init()
ensure_schema()

FAILED_LOGINS: dict[str, list[float]] = {}


def check_rate_limit(phone: str):
    now = time.time()
    window = 600  # 10 minutes
    attempts = [t for t in FAILED_LOGINS.get(phone, []) if now - t < window]
    FAILED_LOGINS[phone] = attempts
    if len(attempts) >= 5:
        raise HTTPException(
            429,
            "Too many failed login attempts. Please wait 10 minutes.",
        )


def record_failed_login(phone: str):
    now = time.time()
    window = 600
    attempts = [t for t in FAILED_LOGINS.get(phone, []) if now - t < window]
    attempts.append(now)
    FAILED_LOGINS[phone] = attempts


def reset_failed_login(phone: str):
    FAILED_LOGINS.pop(phone, None)


def tok(uid: int, token_ver: int = 1, exp: int | None = None) -> str:
    exp = exp or int(time.time()) + 43200  # 12 hour sessions
    payload = f"{uid}.{token_ver}.{exp}"
    signature = hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    return f"{uid}.{token_ver}.{exp}.{signature}"


def auth(authorization: str = Header("")):
    try:
        parts = authorization.split(".")
        if len(parts) == 3:
            uid, exp, sig = parts
            token_ver = 1
            expected_sig = hmac.new(
                SECRET.encode(), f"{uid}.{exp}".encode(), hashlib.sha256
            ).hexdigest()[:24]
        elif len(parts) == 4:
            uid, token_ver_str, exp, sig = parts
            token_ver = int(token_ver_str)
            expected_sig = tok(int(uid), token_ver, int(exp)).split(".")[3]
        else:
            raise ValueError("Invalid token format")

        if int(exp) <= time.time():
            raise ValueError("Token expired")
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("Invalid signature")

        user = q("select * from users where id = ?", int(uid), one=True)
        if not user:
            raise ValueError("User not found")
        current_ver = user.get("token_ver") or 1
        if int(token_ver) != current_ver:
            raise ValueError("Token revoked")
        return user
    except Exception:
        raise HTTPException(401, "Sign in again")


def need(user: dict | None, role: str):
    if not user or user.get("role") != role:
        raise HTTPException(403, "Not allowed for your role")


def check_consent(u: dict):
    if u.get("role") == "customer" and not u.get("consent_at"):
        raise HTTPException(
            403,
            {"code": "CONSENT_REQUIRED", "message": "Consent is required to place or manage health orders"},
        )


def check_minor_guardian_consent(u: dict, for_name: str):
    prof = q(
        "select * from profiles where customer_id = ? and name = ?",
        u["id"],
        for_name.strip(),
        one=True,
    )
    if prof and prof.get("is_minor") and not prof.get("guardian_consent"):
        raise HTTPException(
            422,
            "Cannot place orders for a minor profile without recorded guardian consent",
        )


class Login(BaseModel):
    phone: str
    otp: str


@app.post("/api/login")
def login(b: Login):
    phone = b.phone.strip()
    check_rate_limit(phone)
    user = q("select * from users where phone = ?", phone, one=True)
    if not user or b.otp != "123456":
        record_failed_login(phone)
        raise HTTPException(401, "Wrong phone or OTP (demo OTP is 123456)")
    reset_failed_login(phone)
    token_ver = user.get("token_ver") or 1
    return {"token": tok(user["id"], token_ver), "user": user}


@app.post("/api/logout")
def logout(u=Depends(auth)):
    ex(
        "update users set token_ver = coalesce(token_ver, 1) + 1 where id = ?",
        u["id"],
    )
    log(u["name"], "logout", f"user {u['id']}")
    return {"ok": True}


@app.post("/api/consent")
def give_consent(u=Depends(auth)):
    need(u, "customer")
    now = int(time.time())
    ex("update users set consent_at = ? where id = ?", now, u["id"])
    log(u["name"], "grant_consent", str(now))
    return {"ok": True, "consent_at": now}


# ---- AI prescription reading: draft only ----
DEMOS = {
    "clean": {
        "legible": True,
        "lines": [
            {"text": "Metformin 500 mg", "qty": 4, "conf": 0.98},
            {"text": "Telmisartan 40 mg", "qty": 3, "conf": 0.97},
        ],
    },
    "handwritten": {
        "legible": True,
        "lines": [{"text": "Levothyroxin 50 mcg", "qty": 1, "conf": 0.54}],
    },
    "blurry": {"legible": False, "lines": []},
    "s50211": {"legible": True, "lines": [{"text": "Metformin 500 mg", "qty": 4}]},
    "s50214": {"legible": True, "lines": [{"text": "Telmisartan 40 mg", "qty": 3}]},
    "h1": {
        "legible": True,
        "lines": [{"text": "Alprazolam 0.25 mg", "qty": 1, "conf": 0.93}],
    },
    "schedx": {
        "legible": True,
        "lines": [
            {"text": "Demo Narcotic 5 mg", "qty": 1, "conf": 0.90},
            {"text": "Paracetamol 500 mg", "qty": 2, "conf": 0.95},
        ],
    },
}

PROMPT = (
    "Read this prescription. Return JSON {legible:bool, lines:[{text,qty,conf}]} with conf 0-1. "
    "Never guess unreadable text. No medical advice."
)


def azure(raw: bytes):
    import httpx

    ep = os.environ["AZURE_OPENAI_ENDPOINT"]
    key = os.environ["AZURE_OPENAI_KEY"]
    dep = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    img = "data:image/png;base64," + base64.b64encode(raw).decode()

    r = httpx.post(
        f"{ep}/openai/deployments/{dep}/chat/completions?api-version=2024-06-01",
        headers={"api-key": key},
        timeout=30,
        json={
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": PROMPT},
                {
                    "role": "user",
                    "content": [{"type": "image_url", "image_url": {"url": img}}],
                },
            ],
        },
    )
    r.raise_for_status()
    return json.loads(r.json()["choices"][0]["message"]["content"])


def extract(raw: bytes, demo: str):
    if os.getenv("AZURE_OPENAI_ENDPOINT"):
        try:
            return azure(raw)
        except Exception as e:
            # Log the error visibly in server output; fall back to manual pharmacist review.
            print(f"[azure] extraction failed: {e}", flush=True)
            return {"legible": None, "lines": []}  # AI down -> manual review
    return DEMOS.get(demo, {"legible": None, "lines": []})  # no key and no demo: nothing guessed


def demo_png(kind: str) -> bytes:
    if kind not in DEMOS:
        return b""
    im = Image.new("RGB", (560, 380), "white")
    draw = ImageDraw.Draw(im)
    draw.text((20, 20), "Dr. A. Banerjee, Reg. No. WB-12345 (sample)", fill="black")
    lines = DEMOS[kind]["lines"] or [{"text": "illegible"}]
    for i, line in enumerate(lines):
        draw.text(
            (30, 80 + i * 40),
            f"Rx  {line['text']}   x{line.get('qty', '')}",
            fill="black",
        )
    if kind == "blurry":
        im = im.filter(ImageFilter.GaussianBlur(7))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def match(text: str):
    names = [m["name"] for m in q("select name from meds where generic_of is null")]
    hit = difflib.get_close_matches(text, [n.split(",")[0] for n in names], 1, 0.6)
    if not hit:
        return None, 0
    matched_med = q(
        "select * from meds where generic_of is null and name like ?",
        hit[0] + "%",
        one=True,
    )
    return matched_med, difflib.SequenceMatcher(None, text, hit[0]).ratio()


@app.post("/api/orders")
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

    # Not race-safe under concurrent load; use a DB sequence or UUID for production.
    order_count = q("select count(*) n from orders", one=True)["n"]
    code = f"RX-{50220 + order_count}"
    with open(f"{STORE}/{code}.enc", "wb") as enc_file:
        enc_file.write(Fernet(FKEY).encrypt(raw))

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
        m, ratio = match(l["text"])
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

        raw_qty = ''.join(filter(str.isdigit, str(l.get('qty', 1)))) or '1'
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


@app.post("/api/orders/{code}/reupload")
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

    with open(f"{STORE}/{code}.enc", "wb") as enc_file:
        enc_file.write(Fernet(FKEY).encrypt(raw))
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
        m, ratio = match(l["text"])
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

        raw_qty = ''.join(filter(str.isdigit, str(l.get('qty', 1)))) or '1'
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


def full(o: dict) -> dict:
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


@app.get("/api/orders")
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
    return [full(o) for o in rows]


@app.get("/api/orders/{code}/rx")
def get_rx_image(code: str, u=Depends(auth)):
    need(u, "pharmacist")
    o = q("select * from orders where code = ?", code, one=True)
    if not o or not o["rx_file"] or not os.path.exists(f"{STORE}/{o['rx_file']}"):
        raise HTTPException(404, "No prescription image on file")
    log(u["name"], "view_rx", code)
    with open(f"{STORE}/{o['rx_file']}", "rb") as enc_file:
        decrypted_bytes = Fernet(FKEY).decrypt(enc_file.read())
    return Response(content=decrypted_bytes, media_type="image/png")


@app.get("/api/orders/{code}/audit")
def get_order_audit(code: str, u=Depends(auth)):
    need(u, "pharmacist")
    o = q("select * from orders where code = ?", code, one=True)
    if not o:
        raise HTTPException(404, "Order not found")
    logs = q(
        "select * from audit where entity = ? or entity like ? or (action in ('view_rx', 'upload_rx', 'reupload_rx', 'ask_reupload') and entity = ?) order by ts desc",
        code,
        f"%{code}%",
        code,
    )
    return logs


class Decision(BaseModel):
    action: str
    reason: str = ""
    qty: int | None = None
    prescriber: str = ""
    patient: str = ""


def settle(code: str):
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


@app.post("/api/items/{iid}/decide")
def decide(iid: int, d: Decision, u=Depends(auth)):
    need(u, "pharmacist")
    item = q("select * from items where id = ?", iid, one=True)
    if not item:
        raise HTTPException(404, "Item not found")

    order = q("select * from orders where code = ?", item["order_code"], one=True)
    if not order:
        raise HTTPException(404, "Order not found")

    if d.action == "reject":
        if not d.reason.strip():
            raise HTTPException(422, "A reason is required to reject")
        ex(
            "update items set status = 'rejected', reason = ? where id = ?",
            d.reason.strip()[:200],
            iid,
        )
    elif d.action == "approve":
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
            has_order_file = bool(order["rx_file"] and os.path.exists(f"{STORE}/{order['rx_file']}"))
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

            # Store or refresh prescription record if order has an uploaded image
            if has_order_file:
                approved_at = today_str
                valid_until = (date.today() + timedelta(days=RX_VALID_DAYS)).isoformat()
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


class Hold(BaseModel):
    reason: str


@app.post("/api/orders/{code}/hold")
def hold(code: str, b: Hold, u=Depends(auth)):
    need(u, "pharmacist")
    note = b.reason.strip()[:200] or "Please upload a clearer prescription."
    ex("update orders set status = 'on_hold', note = ? where code = ?", note, code)
    log(u["name"], "ask_reupload", code)
    return {"ok": True}


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


@app.post("/api/orders/{code}/pack")
def pack(code: str, b: Pack, u=Depends(auth)):
    if not b.invoice.strip():
        raise HTTPException(422, "Enter the store invoice number")
    return advance(code, "approved", "packed", u, b.invoice.strip()[:30])


class DispatchReq(BaseModel):
    partner: str | None = None


@app.post("/api/orders/{code}/dispatch")
def dispatch(code: str, b: DispatchReq | None = None, u=Depends(auth)):
    partner = (b.partner if b and b.partner else "Local Express Delivery").strip()[:60]
    res = advance(code, "packed", "dispatched", u)
    ex("update orders set delivery_partner = ? where code = ?", partner, code)
    return {**res, "delivery_partner": partner}


@app.get("/api/refills")
def refills(u=Depends(auth)):
    need(u, "customer")
    results = []
    query = (
        "select r.*, m.name from refills r "
        "join meds m on m.id = r.med_id where customer_id = ?"
    )
    for r in q(query, u["id"]):
        filled_date = date.fromisoformat(r["last_filled"])
        days_supply = r["qty"] // r["per_day"]
        left = (filled_date + timedelta(days=days_supply) - date.today()).days
        results.append({**r, "days_left": left, "due": left <= 5})
    return sorted(results, key=lambda r: r["days_left"])


@app.post("/api/refills/{rid}/reorder")
def reorder(rid: int, u=Depends(auth)):
    need(u, "customer")
    check_consent(u)
    r = q(
        "select * from refills where id = ? and customer_id = ?",
        rid,
        u["id"],
        one=True,
    )
    if not r:
        raise HTTPException(404, "Refill not found")

    check_minor_guardian_consent(u, r["for_name"])
    m = q("select * from meds where id = ?", r["med_id"], one=True)
    order_count = q("select count(*) n from orders", one=True)["n"]
    code = f"RX-{50220 + order_count}"

    today_str = date.today().isoformat()
    valid_rx = q(
        "select * from prescriptions where customer_id = ? and profile_name = ? and valid_until >= ? order by valid_until desc limit 1",
        u["id"],
        r["for_name"],
        today_str,
        one=True,
    )

    if valid_rx and valid_rx["rx_file"] and os.path.exists(f"{STORE}/{valid_rx['rx_file']}"):
        rx_file = f"{code}.enc"
        shutil.copyfile(f"{STORE}/{valid_rx['rx_file']}", f"{STORE}/{rx_file}")
        status = "awaiting_pharmacist"
        note = f"Prescription on file, valid until {valid_rx['valid_until']}"
    else:
        rx_file = None
        status = "on_hold"
        note = "Please upload a current prescription"

    ex(
        "insert into orders(code, customer_id, for_name, status, store_id, rx_file, note, created) values(?, ?, ?, ?, ?, ?, ?, ?)",
        code,
        u["id"],
        r["for_name"],
        status,
        None,
        rx_file,
        note,
        int(time.time()),
    )
    ex(
        "insert into items(order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        code,
        m["id"],
        m["name"],
        m["schedule"],
        max(1, r["qty"] // 15),
        m["price"],
        1.0,
        "draft",
        None,
        "",
    )
    log(u["name"], "reorder", code)
    return {"code": code, "status": status, "note": note}


@app.post("/api/items/{iid}/offer-generic")
def offer(iid: int, u=Depends(auth)):
    need(u, "pharmacist")
    it = q("select * from items where id = ?", iid, one=True)
    if not it:
        raise HTTPException(404, "Item not found")
    if it["status"] != "approved":
        raise HTTPException(422, "Approve the line before offering a generic")

    g = q("select * from meds where generic_of = ?", it["med_id"], one=True)
    if not g:
        raise HTTPException(422, "No generic on file for this medicine")

    ex("update items set offer = ? where id = ?", g["id"], iid)
    log(u["name"], "offer_generic", f"item {iid}")
    return {"ok": True}


class Consent(BaseModel):
    accept: bool


@app.post("/api/items/{iid}/consent")
def consent(iid: int, b: Consent, u=Depends(auth)):
    need(u, "customer")
    it = q(
        "select i.*, o.customer_id cid from items i join orders o on o.code = i.order_code where i.id = ?",
        iid,
        one=True,
    )
    if not it or it["cid"] != u["id"] or not it["offer"] or it["consent"] is not None:
        raise HTTPException(404, "No generic offer to answer")

    if b.accept:
        g = q("select * from meds where id = ?", it["offer"], one=True)
        orig_price = it.get("original_price") or it["price"]
        ex(
            "update items set med_id = ?, name = ?, price = ?, consent = 1, original_price = ? where id = ?",
            g["id"],
            g["name"],
            g["price"],
            orig_price,
            iid,
        )
    else:
        ex("update items set consent = 0 where id = ?", iid)

    log(u["name"], "generic_accept" if b.accept else "generic_decline", f"item {iid}")
    settle(it["order_code"])
    return {"ok": True}


@app.get("/api/dashboard")
def dashboard(u=Depends(auth)):
    need(u, "pharmacist")
    all_orders = q("select * from orders")

    stores = q("select * from stores order by id")
    store_names: dict[int, str] = {s["id"]: s["name"] for s in stores}

    by_store: dict[str, int] = {}
    rejections: dict[str, int] = {}

    for o in all_orders:
        name = store_names.get(o["store_id"], "Not routed")
        by_store[name] = by_store.get(name, 0) + 1

    for i in q("select reason from items where status = 'rejected'"):
        reason = i["reason"] or "No reason given"
        rejections[reason] = rejections.get(reason, 0) + 1

    mins = [
        (o["verified_at"] - o["created"]) / 60
        for o in all_orders
        if o["verified_at"]
    ]

    stock_rows = q("select s.store_id, s.med_id, s.qty, m.name as med_name from stock s join meds m on m.id = s.med_id")
    low_stock_alerts = [
        {
            "store_id": s["store_id"],
            "store_name": store_names.get(s["store_id"], f"Store #{s['store_id']}"),
            "med_id": s["med_id"],
            "med_name": s["med_name"],
            "qty": s["qty"],
        }
        for s in stock_rows
        if s["qty"] <= 5
    ]

    stores_summary = []
    for s in stores:
        sid = s["id"]
        s_orders = [o for o in all_orders if o["store_id"] == sid]
        stores_summary.append({
            "id": sid,
            "name": s["name"],
            "total_orders": len(s_orders),
            "awaiting": sum(1 for o in s_orders if o["status"] == "awaiting_pharmacist"),
            "approved": sum(1 for o in s_orders if o["status"] == "approved"),
            "packed": sum(1 for o in s_orders if o["status"] == "packed"),
            "dispatched": sum(1 for o in s_orders if o["status"] == "dispatched"),
            "low_stock_count": sum(1 for a in low_stock_alerts if a["store_id"] == sid),
        })

    return {
        "by_store": by_store,
        "rejections": rejections,
        "median_verify_min": round(statistics.median(mins), 1) if mins else None,
        "register": q("select * from register order by ts desc"),
        "audit": q("select * from audit order by ts desc limit 15"),
        "stores_summary": stores_summary,
        "low_stock_alerts": low_stock_alerts,
        "network_overview": {
            "total_stores": len(stores),
            "active_orders": sum(1 for o in all_orders if o["status"] not in ("dispatched", "rejected")),
            "total_orders": len(all_orders),
        },
    }


@app.post("/api/stock")
async def stock(file: UploadFile = File(...), u=Depends(auth)):
    need(u, "pharmacist")
    try:
        content = (await file.read()).decode()
        reader = csv.DictReader(io.StringIO(content))
        rows = [
            (int(x["store_id"]), int(x["med_id"]), int(x["qty"]))
            for x in reader
        ]
        assert rows and all(qty >= 0 for _, _, qty in rows)
    except Exception:
        raise HTTPException(
            422, "CSV needs the columns store_id, med_id, qty with whole numbers"
        )

    connection = db()
    connection.executemany("insert or replace into stock values(?, ?, ?)", rows)
    connection.commit()
    connection.close()

    log(u["name"], "stock_upload", f"{len(rows)} rows")
    return {"rows": len(rows)}


@app.get("/api/search")
def search(term: str = "", u=Depends(auth)):
    need(u, "customer")
    term_clean = term.strip()[:40]
    if len(term_clean) < 2:
        return []

    rows = q(
        "select id, name, schedule, price from meds where generic_of is null and name like ? limit 10",
        f"%{term_clean}%",
    )
    for m in rows:
        m_rule = rule(m["schedule"])
        if m_rule["blocked"]:
            m["rule"] = "blocked"
        elif m_rule["rx"]:
            m["rule"] = "rx"
        else:
            m["rule"] = "ok"
    return rows


class CartLine(BaseModel):
    med_id: int
    qty: int


class Cart(BaseModel):
    for_name: str
    lines: list[CartLine]
    payment: str = "cod"
    area: str = "Park Street"


@app.post("/api/cart")
def cart(b: Cart, u=Depends(auth)):
    # over-the-counter items only; anything else must go through a prescription
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


@app.get("/api/profiles")
def get_profiles(u=Depends(auth)):
    need(u, "customer")
    return q("select * from profiles where customer_id = ?", u["id"])


class Profile(BaseModel):
    name: str
    relation: str = "Family"
    is_minor: bool = False
    guardian_consent: bool = False


@app.post("/api/profiles")
def add_profile(b: Profile, u=Depends(auth)):
    need(u, "customer")
    name = b.name.strip()[:60]
    if not name:
        raise HTTPException(422, "Enter a name")

    if b.is_minor and not b.guardian_consent:
        raise HTTPException(422, "Guardian consent is required for profiles under 18")

    if q(
        "select 1 x from profiles where customer_id = ? and name = ?",
        u["id"],
        name,
        one=True,
    ):
        raise HTTPException(409, "This person is already added")

    ex(
        "insert into profiles(customer_id, name, relation, is_minor, guardian_consent) values(?, ?, ?, ?, ?)",
        u["id"],
        name,
        b.relation.strip()[:30],
        1 if b.is_minor else 0,
        1 if b.guardian_consent else 0,
    )
    return {"ok": True}


@app.get("/api/me/export")
def export_my_data(u=Depends(auth)):
    need(u, "customer")
    my_orders = q(
        "select * from orders where customer_id = ? order by created desc, code desc",
        u["id"],
    )
    for o in my_orders:
        o["items"] = q("select * from items where order_code = ?", o["code"])
    my_profiles = q("select * from profiles where customer_id = ?", u["id"])
    my_notes = q("select * from notes where customer_id = ? order by ts desc", u["id"])
    my_prescriptions = q("select * from prescriptions where customer_id = ?", u["id"])
    return {
        "user": {
            "id": u["id"],
            "name": u["name"],
            "phone": u["phone"],
            "role": u["role"],
            "consent_at": u.get("consent_at"),
        },
        "profiles": my_profiles,
        "orders": my_orders,
        "notes": my_notes,
        "prescriptions": my_prescriptions,
    }


@app.get("/api/notes")
def get_notes(u=Depends(auth)):
    need(u, "customer")
    return q(
        "select * from notes where customer_id = ? order by ts desc limit 10",
        u["id"],
    )


def notify(phone: str, text: str):
    """Notification stub: prints to stdout or integrates with SMS/WhatsApp provider."""
    print(f"[notify] SMS to {phone}: {text}", flush=True)


@app.post("/api/reminders/run")
def run_reminders(u=Depends(auth)):
    need(u, "pharmacist")
    count = 0
    notified = []
    today = date.today().isoformat()

    for r in q(
        "select r.*, m.name, u.phone from refills r "
        "join meds m on m.id = r.med_id "
        "join users u on u.id = r.customer_id"
    ):
        filled_date = date.fromisoformat(r["last_filled"])
        days_supply = r["qty"] // r["per_day"]
        left = (filled_date + timedelta(days=days_supply) - date.today()).days

        if left <= 5 and not q(
            "select 1 x from notes where customer_id = ? and day = ? and text like ?",
            r["customer_id"],
            today,
            f"%{r['name']}%{r['for_name']}%",
            one=True,
        ):
            msg = f"{r['name']} for {r['for_name']} runs out in about {max(left, 0)} days. Reorder in one tap."
            ex(
                "insert into notes values(?, ?, ?, ?)",
                r["customer_id"],
                msg,
                int(time.time()),
                today,
            )
            if r.get("phone"):
                notify(r["phone"], msg)
                notified.append(r["phone"])
            count += 1

    log(u["name"], "run_reminders", f"{count} sent")
    return {"sent": count, "notified": notified}


@app.get("/")
def root():
    index_file = os.path.join(FRONTEND_DIST, "index.html") if os.path.exists(FRONTEND_DIST) else None
    if index_file and os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "service": "RefillCare API",
        "status": "healthy",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "auth": "/api/login",
            "orders": "/api/orders",
            "refills": "/api/refills",
            "dashboard": "/api/dashboard",
        },
    }


def seed_images():
    # sample orders get a synthetic prescription so the side-by-side screen is never empty
    samples = [("RX-50211", "s50211"), ("RX-50214", "s50214"), ("RX-50219", "blurry")]
    for code, kind in samples:
        o = q("select rx_file from orders where code = ?", code, one=True)
        if o and not o["rx_file"]:
            enc = Fernet(FKEY).encrypt(demo_png(kind))
            with open(f"{STORE}/{code}.enc", "wb") as enc_file:
                enc_file.write(enc)
            ex("update orders set rx_file = ? where code = ?", f"{code}.enc", code)


seed_images()


@app.get("/{full_path:path}")
def catch_all(full_path: str):
    if os.path.exists(FRONTEND_DIST):
        target = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(target):
            return FileResponse(target)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not Found")

