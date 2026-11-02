import os, io, json, statistics, base64, hashlib, hmac, sqlite3, difflib, csv, time
from datetime import date, timedelta
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from cryptography.fernet import Fernet
from PIL import Image, ImageDraw, ImageFilter
from rules import can_dispatch, route, rule

DB = os.getenv("DB_PATH", "pharmacy.db"); SECRET = os.getenv("APP_SECRET", "dev-only-secret")
FKEY = os.getenv("RX_ENC_KEY") or base64.urlsafe_b64encode(hashlib.sha256(SECRET.encode()).digest())
STORE = "rx_store"; os.makedirs(STORE, exist_ok=True)
app = FastAPI(title="Pharmacy reorder")
AREAS = {"Park Street": (22.5535, 88.3520), "Salt Lake": (22.5867, 88.4171), "Behala": (22.4985, 88.3118), "Howrah": (22.5800, 88.3250)}  # sample coordinates

SCHEMA = """create table users(id integer primary key,name,phone unique,role,store_id);
create table meds(id integer primary key,name,schedule,price,generic_of);
create table stores(id integer primary key,name,lat,lng);
create table stock(store_id,med_id,qty,primary key(store_id,med_id));
create table orders(code primary key,customer_id,for_name,status,store_id,rx_file,note,created,verified_at,invoice_no,payment default 'cod',paid default 0,area default 'Park Street');
create table items(id integer primary key,order_code,med_id,name,schedule,qty,price,conf,status,approved_by,reason,offer,consent);
create table refills(id integer primary key,customer_id,for_name,med_id,qty,per_day,last_filled);
create table audit(ts,actor,action,entity);
create table profiles(id integer primary key,customer_id,name,relation);
create table notes(customer_id,text,ts,day);
create table register(order_code,item_id,prescriber,patient,qty,ts);"""

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c
def q(sql, *a, one=False):
    c = db(); rows = [dict(r) for r in c.execute(sql, a)]; c.close()
    return (rows[0] if rows else None) if one else rows
def ex(sql, *a):
    c = db(); cur = c.execute(sql, a); c.commit(); i = cur.lastrowid; c.close(); return i
def log(actor, action, entity): ex("insert into audit values(?,?,?,?)", int(time.time()), actor, action, entity)

MEDS = [(1, "Metformin 500 mg, strip of 15", "H", 120), (2, "Telmisartan 40 mg, strip of 10", "H", 285),
        (3, "Levothyroxine 50 mcg, bottle of 100", "H", 190), (4, "Amlodipine 5 mg, strip of 15", "H", 60),
        (5, "Glimepiride 1 mg, strip of 10", "H", 85), (6, "Alprazolam 0.25 mg, strip of 10", "H1", 40),
        (7, "Paracetamol 500 mg, strip of 10", "OTC", 30), (8, "Demo Restricted-X 10 mg, strip of 10", "X", 0),
        (9, "Demo Narcotic 5 mg, strip of 10", "NARC", 0)]
def init():
    if os.path.exists(DB): return
    c = db(); c.executescript(SCHEMA)
    for u in [(1, "Debasish Ghosh", "9000000001", "customer"), (2, "Rina Sen", "9000000002", "customer"),
              (3, "Arif Mondal", "9000000003", "customer"), (5, "Store staff, Salt Lake", "9000000081", "store"), (6, "Store staff, Behala", "9000000082", "store"), (7, "Store staff, Howrah", "9000000083", "store"), (9, "Anita Rao (pharmacist)", "9000000099", "pharmacist")]:
        c.execute("insert into users(id,name,phone,role) values(?,?,?,?)", u)
    c.execute("update users set store_id=id-4 where role='store'")
    c.executemany("insert into profiles(customer_id,name,relation) values(?,?,?)", [(1, "Debasish Ghosh", "Self"), (1, "Mother", "Mother"), (2, "Rina Sen", "Self"), (3, "Arif Mondal", "Self")])
    c.executemany("insert into meds(id,name,schedule,price) values(?,?,?,?)", MEDS)
    c.executemany("insert into meds values(?,?,?,?,?)", [(10, "Metformin 500 mg (generic), strip of 15", "H", 80, 1), (11, "Telmisartan 40 mg (generic), strip of 10", "H", 190, 2)])
    c.executemany("insert into stores values(?,?,?,?)", [(1, "Salt Lake", 22.5867, 88.4171), (2, "Behala", 22.4985, 88.3118), (3, "Howrah Maidan", 22.5800, 88.3250)])
    for r in csv.DictReader(open("data/stock.csv")):
        c.execute("insert into stock values(?,?,?)", (int(r["store_id"]), int(r["med_id"]), int(r["qty"])))
    t = int(time.time()); d = lambda n: (date.today() - timedelta(days=n)).isoformat()
    c.executemany("insert into orders(code,customer_id,for_name,status,store_id,rx_file,note,created) values(?,?,?,?,?,?,?,?)", [
        ("RX-50211", 1, "Mother", "packed", 1, None, "", t), ("RX-50214", 2, "Rina Sen", "awaiting_pharmacist", 2, None, "", t),
        ("RX-50219", 3, "Arif Mondal", "on_hold", 3, None, "Prescription not readable. Please upload a clearer photo.", t)])
    c.executemany("insert into items(order_code,med_id,name,schedule,qty,price,conf,status,approved_by,reason) values(?,?,?,?,?,?,?,?,?,?)", [
        ("RX-50211", 1, MEDS[0][1], "H", 4, 120, .98, "approved", 9, ""), ("RX-50214", 2, MEDS[1][1], "H", 3, 285, .9, "draft", None, ""),
        ("RX-50219", 3, MEDS[2][1], "H", 1, 190, .4, "draft", None, "")])
    c.executemany("insert into refills(customer_id,for_name,med_id,qty,per_day,last_filled) values(?,?,?,?,?,?)", [
        (1, "Mother", 1, 60, 2, d(26)), (2, "Rina Sen", 2, 30, 1, d(25)), (1, "Mother", 4, 45, 1, d(10))])
    c.execute("update orders set created=?, verified_at=? where code='RX-50211'", (t - 900, t - 300))
    c.commit(); c.close()
init()

def tok(uid, exp=None):
    exp = exp or int(time.time()) + 43200  # 12 hour sessions
    return f"{uid}.{exp}.{hmac.new(SECRET.encode(), f'{uid}.{exp}'.encode(), hashlib.sha256).hexdigest()[:24]}"
def auth(authorization: str = Header("")):
    try:
        uid, exp, sig = authorization.split("."); assert int(exp) > time.time() and hmac.compare_digest(sig, tok(uid, exp).split(".")[2])
        return q("select * from users where id=?", int(uid), one=True)
    except Exception: raise HTTPException(401, "Sign in again")
def need(u, role):
    if not u or u["role"] != role: raise HTTPException(403, "Not allowed for your role")

class Login(BaseModel): phone: str; otp: str
@app.post("/api/login")
def login(b: Login):
    u = q("select * from users where phone=?", b.phone.strip(), one=True)
    if not u or b.otp != "123456": raise HTTPException(401, "Wrong phone or OTP (demo OTP is 123456)")
    return {"token": tok(u["id"]), "user": u}

# ---- AI prescription reading: draft only ----
DEMOS = {"clean": {"legible": True, "lines": [{"text": "Metformin 500 mg", "qty": 4, "conf": .98}, {"text": "Telmisartan 40 mg", "qty": 3, "conf": .97}]},
         "handwritten": {"legible": True, "lines": [{"text": "Levothyroxin 50 mcg", "qty": 1, "conf": .54}]},
         "blurry": {"legible": False, "lines": []},
         "s50211": {"legible": True, "lines": [{"text": "Metformin 500 mg", "qty": 4}]},
         "s50214": {"legible": True, "lines": [{"text": "Telmisartan 40 mg", "qty": 3}]},
         "h1": {"legible": True, "lines": [{"text": "Alprazolam 0.25 mg", "qty": 1, "conf": .93}]},
         "schedx": {"legible": True, "lines": [{"text": "Demo Narcotic 5 mg", "qty": 1, "conf": .9}, {"text": "Paracetamol 500 mg", "qty": 2, "conf": .95}]}}
PROMPT = "Read this prescription. Return JSON {legible:bool, lines:[{text,qty,conf}]} with conf 0-1. Never guess unreadable text. No medical advice."
def azure(raw):
    import httpx
    ep, key, dep = os.environ["AZURE_OPENAI_ENDPOINT"], os.environ["AZURE_OPENAI_KEY"], os.environ["AZURE_OPENAI_DEPLOYMENT"]
    img = "data:image/png;base64," + base64.b64encode(raw).decode()
    r = httpx.post(f"{ep}/openai/deployments/{dep}/chat/completions?api-version=2024-06-01", headers={"api-key": key}, timeout=30,
        json={"response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": PROMPT},
              {"role": "user", "content": [{"type": "image_url", "image_url": {"url": img}}]}]})
    r.raise_for_status(); return json.loads(r.json()["choices"][0]["message"]["content"])
def extract(raw, demo):
    if os.getenv("AZURE_OPENAI_ENDPOINT"):
        try: return azure(raw)
        except Exception: return {"legible": None, "lines": []}  # AI down -> manual review
    return DEMOS.get(demo, {"legible": None, "lines": []})  # no key and no demo: nothing is guessed
def demo_png(kind):
    if kind not in DEMOS: return b""
    im = Image.new("RGB", (560, 380), "white"); d = ImageDraw.Draw(im)
    d.text((20, 20), "Dr. A. Banerjee, Reg. No. WB-12345 (sample)", fill="black")
    for i, l in enumerate(DEMOS[kind]["lines"] or [{"text": "illegible"}]): d.text((30, 80 + i * 40), f"Rx  {l['text']}   x{l.get('qty','')}", fill="black")
    if kind == "blurry": im = im.filter(ImageFilter.GaussianBlur(7))
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()
def match(text):
    names = [m["name"] for m in q("select name from meds where generic_of is null")]
    hit = difflib.get_close_matches(text, [n.split(",")[0] for n in names], 1, 0.6)
    if not hit: return None, 0
    m = q("select * from meds where generic_of is null and name like ?", hit[0] + "%", one=True)
    return m, difflib.SequenceMatcher(None, text, hit[0]).ratio()

@app.post("/api/orders")
async def new_order(for_name: str = Form(...), demo: str = Form(""), payment: str = Form("cod"), area: str = Form("Park Street"), file: UploadFile = File(None), u=Depends(auth)):
    need(u, "customer")
    raw = await file.read() if file else demo_png(demo)
    if not raw: raise HTTPException(400, "Add a prescription photo or pick a demo prescription")
    if len(raw) > 5_000_000: raise HTTPException(413, "File is too large (max 5 MB)")
    if not (raw[:4] == b"\x89PNG" or raw[:3] == b"\xff\xd8\xff"): raise HTTPException(415, "Upload a PNG or JPEG photo")
    if not q("select 1 x from profiles where customer_id=? and name=?", u["id"], for_name.strip(), one=True): raise HTTPException(422, "Choose who this order is for")
    if payment not in ("cod", "upi_test") or area not in AREAS: raise HTTPException(422, "Choose a valid payment method and delivery area")
    code = f"RX-{50220 + q('select count(*) n from orders', one=True)['n']}"
    open(f"{STORE}/{code}.enc", "wb").write(Fernet(FKEY).encrypt(raw))
    res = extract(raw, demo); note = ""
    status = "awaiting_pharmacist"
    if res["legible"] is False: status, note = "on_hold", "Prescription not readable. Please upload a clearer photo."
    if res["legible"] is None: note = "Automatic reading unavailable. Pharmacist will read it manually."
    ex("insert into orders(code,customer_id,for_name,status,store_id,rx_file,note,created) values(?,?,?,?,?,?,?,?)", code, u["id"], for_name.strip()[:60] or u["name"], status, None, f"{code}.enc", note, int(time.time()))
    ex("update orders set payment=?, paid=?, area=? where code=?", payment, 1 if payment == "upi_test" else 0, area, code)  # test mode: no real payment
    for l in res["lines"]:
        m, ratio = match(l["text"]); conf = round(min(l["conf"], ratio), 2)
        sched = m["schedule"] if m else "H"
        if m and rule(sched)["blocked"]:
            ex("insert into items(order_code,med_id,name,schedule,qty,price,conf,status,approved_by,reason) values(?,?,?,?,?,?,?,?,?,?)", code, m["id"], m["name"], sched, 1, 0, conf, "rejected", None, "Cannot be sold online"); continue
        ex("insert into items(order_code,med_id,name,schedule,qty,price,conf,status,approved_by,reason) values(?,?,?,?,?,?,?,?,?,?)", code, m["id"] if m else None, m["name"] if m else l["text"] + " (not in catalog)", sched, max(1, min(int(l["qty"]), 50)), m["price"] if m else 0, conf, "draft", None, "")
    log(u["name"], "upload_rx", code); return {"code": code}

def full(o):
    o["items"] = q("select * from items where order_code=?", o["code"])
    for i in o["items"]:
        i["generic"] = q("select name,price from meds where generic_of=?", i["med_id"], one=True) if i["med_id"] else None
        i["offer_med"] = q("select name,price from meds where id=?", i["offer"], one=True) if i["offer"] else None
    o["store"] = (q("select name from stores where id=?", o["store_id"], one=True) or {}).get("name"); return o
@app.get("/api/orders")
def orders(u=Depends(auth)):
    if u["role"] == "customer": rows = q("select * from orders where customer_id=? order by created desc, code desc", u["id"])
    elif u["role"] == "store": rows = q("select * from orders where store_id=? and status in ('awaiting_pharmacist','approved','packed','dispatched') order by created desc, code desc", u["store_id"])
    else: rows = q("select * from orders order by created desc, code desc")
    return [full(o) for o in rows]
@app.get("/api/orders/{code}/rx")
def rx(code: str, u=Depends(auth)):
    need(u, "pharmacist"); o = q("select * from orders where code=?", code, one=True)
    if not o or not o["rx_file"] or not os.path.exists(f"{STORE}/{o['rx_file']}"): raise HTTPException(404, "No prescription image on file")
    log(u["name"], "view_rx", code); return Response(Fernet(FKEY).decrypt(open(f"{STORE}/{o['rx_file']}", "rb").read()))

class Decision(BaseModel): action: str; reason: str = ""; qty: int | None = None; prescriber: str = ""; patient: str = ""
def settle(code):
    its = q("select * from items where order_code=?", code)
    if any(i["status"] == "draft" for i in its): return
    ex("update orders set verified_at=? where code=? and verified_at is null", int(time.time()), code)
    live = [i for i in its if i["status"] == "approved"]
    if not live: ex("update orders set status='rejected' where code=?", code); return
    stores = q("select * from stores")
    for s in stores: s["stock"] = {r["med_id"]: r["qty"] for r in q("select * from stock where store_id=?", s["id"])}
    lat, lng = AREAS.get((q("select area from orders where code=?", code, one=True) or {}).get("area"), AREAS["Park Street"])
    best = route(stores, [(i["med_id"], i["qty"]) for i in live], lat, lng)
    ex("update orders set status='approved', store_id=?, note=? where code=?", best["id"] if best else None, "" if best else "No store has every item in stock", code)
@app.post("/api/items/{iid}/decide")
def decide(iid: int, d: Decision, u=Depends(auth)):
    need(u, "pharmacist"); it = q("select * from items where id=?", iid, one=True)
    if not it: raise HTTPException(404, "Item not found")
    if d.action == "reject":
        if not d.reason.strip(): raise HTTPException(422, "A reason is required to reject")
        ex("update items set status='rejected', reason=? where id=?", d.reason.strip()[:200], iid)
    elif d.action == "approve":
        if it["med_id"] is None: raise HTTPException(422, "Not in catalog. Reject this line or ask for a new prescription")
        qty = d.qty if d.qty is not None else it["qty"]
        if not 1 <= qty <= 50: raise HTTPException(422, "Quantity must be 1 to 50")
        if it["schedule"] == "H1":
            if not d.prescriber.strip() or not d.patient.strip(): raise HTTPException(422, "H1 medicines need the prescriber and patient name for the register")
            ex("insert into register values(?,?,?,?,?,?)", it["order_code"], iid, d.prescriber.strip()[:80], d.patient.strip()[:80], qty, int(time.time()))
        ex("update items set status='approved', approved_by=?, qty=? where id=?", u["id"], qty, iid)
    else: raise HTTPException(422, "Unknown action")
    log(u["name"], d.action, f"item {iid}"); settle(it["order_code"]); return {"ok": True}
class Hold(BaseModel): reason: str
@app.post("/api/orders/{code}/hold")
def hold(code: str, b: Hold, u=Depends(auth)):
    need(u, "pharmacist"); ex("update orders set status='on_hold', note=? where code=?", b.reason.strip()[:200] or "Please upload a clearer prescription.", code); log(u["name"], "ask_reupload", code); return {"ok": True}
def advance(code, frm, to, u, inv=None):
    need(u, "store"); o = q("select * from orders where code=?", code, one=True)
    if not o: raise HTTPException(404, "Order not found")
    its = q("select * from items where order_code=?", code)
    for i in its: i["registered"] = bool(q("select 1 x from register where item_id=?", i["id"]))
    ok, why = can_dispatch(its)
    if not ok: log(u["name"], f"blocked_{to}", code); raise HTTPException(403, {"code": "APPROVAL_REQUIRED", "message": why})
    if o["store_id"] != u["store_id"]: raise HTTPException(403, "This order belongs to another store")
    if o["status"] != frm or not o["store_id"]: raise HTTPException(409, f"Order must be {frm} and routed to a store first")
    ex("update orders set status=?, invoice_no=coalesce(?, invoice_no) where code=?", to, inv, code); log(u["name"], to, code); return {"ok": True}
class Pack(BaseModel): invoice: str
@app.post("/api/orders/{code}/pack")
def pack(code: str, b: Pack, u=Depends(auth)):
    if not b.invoice.strip(): raise HTTPException(422, "Enter the store invoice number")
    return advance(code, "approved", "packed", u, b.invoice.strip()[:30])
@app.post("/api/orders/{code}/dispatch")
def dispatch(code: str, u=Depends(auth)): return advance(code, "packed", "dispatched", u)

@app.get("/api/refills")
def refills(u=Depends(auth)):
    need(u, "customer"); out = []
    for r in q("select r.*, m.name from refills r join meds m on m.id=r.med_id where customer_id=?", u["id"]):
        left = (date.fromisoformat(r["last_filled"]) + timedelta(days=r["qty"] // r["per_day"]) - date.today()).days
        out.append({**r, "days_left": left, "due": left <= 5})
    return sorted(out, key=lambda r: r["days_left"])
@app.post("/api/refills/{rid}/reorder")
def reorder(rid: int, u=Depends(auth)):
    need(u, "customer"); r = q("select * from refills where id=? and customer_id=?", rid, u["id"], one=True)
    if not r: raise HTTPException(404, "Refill not found")
    m = q("select * from meds where id=?", r["med_id"], one=True); code = f"RX-{50220 + q('select count(*) n from orders', one=True)['n']}"
    ex("insert into orders(code,customer_id,for_name,status,store_id,rx_file,note,created) values(?,?,?,?,?,?,?,?)", code, u["id"], r["for_name"], "awaiting_pharmacist", None, None, "Refill. Pharmacist still checks the prescription.", int(time.time()))
    ex("insert into items(order_code,med_id,name,schedule,qty,price,conf,status,approved_by,reason) values(?,?,?,?,?,?,?,?,?,?)", code, m["id"], m["name"], m["schedule"], max(1, r["qty"] // 15), m["price"], 1.0, "draft", None, "")
    log(u["name"], "reorder", code); return {"code": code}
@app.post("/api/items/{iid}/offer-generic")
def offer(iid: int, u=Depends(auth)):
    need(u, "pharmacist"); it = q("select * from items where id=?", iid, one=True)
    if not it: raise HTTPException(404, "Item not found")
    if it["status"] != "approved": raise HTTPException(422, "Approve the line before offering a generic")
    g = q("select * from meds where generic_of=?", it["med_id"], one=True)
    if not g: raise HTTPException(422, "No generic on file for this medicine")
    ex("update items set offer=? where id=?", g["id"], iid); log(u["name"], "offer_generic", f"item {iid}"); return {"ok": True}
class Consent(BaseModel): accept: bool
@app.post("/api/items/{iid}/consent")
def consent(iid: int, b: Consent, u=Depends(auth)):
    need(u, "customer"); it = q("select i.*, o.customer_id cid from items i join orders o on o.code=i.order_code where i.id=?", iid, one=True)
    if not it or it["cid"] != u["id"] or not it["offer"] or it["consent"] is not None: raise HTTPException(404, "No generic offer to answer")
    if b.accept:
        g = q("select * from meds where id=?", it["offer"], one=True)
        ex("update items set med_id=?, name=?, price=?, consent=1 where id=?", g["id"], g["name"], g["price"], iid)
    else: ex("update items set consent=0 where id=?", iid)
    log(u["name"], "generic_accept" if b.accept else "generic_decline", f"item {iid}"); settle(it["order_code"]); return {"ok": True}
@app.get("/api/dashboard")
def dashboard(u=Depends(auth)):
    need(u, "pharmacist"); os_ = q("select * from orders"); by = {}; rej = {}
    for o in os_:
        n = (q("select name from stores where id=?", o["store_id"], one=True) or {}).get("name", "Not routed"); by[n] = by.get(n, 0) + 1
    for i in q("select reason from items where status='rejected'"): k = i["reason"] or "No reason given"; rej[k] = rej.get(k, 0) + 1
    mins = [(o["verified_at"] - o["created"]) / 60 for o in os_ if o["verified_at"]]
    return {"by_store": by, "rejections": rej, "median_verify_min": round(statistics.median(mins), 1) if mins else None,
            "register": q("select * from register order by ts desc"), "audit": q("select * from audit order by ts desc limit 15")}
@app.post("/api/stock")
async def stock(file: UploadFile = File(...), u=Depends(auth)):
    need(u, "pharmacist")
    try:
        rows = [(int(x["store_id"]), int(x["med_id"]), int(x["qty"])) for x in csv.DictReader(io.StringIO((await file.read()).decode()))]
        assert rows and all(n >= 0 for _, _, n in rows)
    except Exception: raise HTTPException(422, "CSV needs the columns store_id, med_id, qty with whole numbers")
    c = db(); c.executemany("insert or replace into stock values(?,?,?)", rows); c.commit(); c.close(); log(u["name"], "stock_upload", f"{len(rows)} rows"); return {"rows": len(rows)}
@app.get("/api/search")
def search(term: str = "", u=Depends(auth)):
    need(u, "customer"); t = term.strip()[:40]
    if len(t) < 2: return []
    rows = q("select id,name,schedule,price from meds where generic_of is null and name like ? limit 10", f"%{t}%")
    for m in rows: m["rule"] = "blocked" if rule(m["schedule"])["blocked"] else "rx" if rule(m["schedule"])["rx"] else "ok"
    return rows
class CartLine(BaseModel): med_id: int; qty: int
class Cart(BaseModel): for_name: str; lines: list[CartLine]; payment: str = "cod"; area: str = "Park Street"
@app.post("/api/cart")
def cart(b: Cart, u=Depends(auth)):  # over-the-counter items only; anything else must go through a prescription
    need(u, "customer")
    if not 1 <= len(b.lines) <= 10: raise HTTPException(422, "Add 1 to 10 items")
    if not q("select 1 x from profiles where customer_id=? and name=?", u["id"], b.for_name.strip(), one=True): raise HTTPException(422, "Choose who this order is for")
    if b.payment not in ("cod", "upi_test") or b.area not in AREAS: raise HTTPException(422, "Choose a valid payment method and delivery area")
    picked = []
    for l in b.lines:
        m = q("select * from meds where id=? and generic_of is null", l.med_id, one=True)
        if not m: raise HTTPException(404, "Medicine not found")
        if rule(m["schedule"])["blocked"]: raise HTTPException(422, f"{m['name']} cannot be sold online")
        if rule(m["schedule"])["rx"]: raise HTTPException(422, f"{m['name']} needs a prescription. Upload one for pharmacist approval")
        if not 1 <= l.qty <= 20: raise HTTPException(422, "Quantity must be 1 to 20")
        picked.append((m, l.qty))
    code = f"RX-{50220 + q('select count(*) n from orders', one=True)['n']}"
    ex("insert into orders(code,customer_id,for_name,status,store_id,rx_file,note,created) values(?,?,?,?,?,?,?,?)", code, u["id"], b.for_name.strip(), "approved", None, None, "", int(time.time()))
    ex("update orders set payment=?, paid=?, area=? where code=?", b.payment, 1 if b.payment == "upi_test" else 0, b.area, code)
    for m, n in picked: ex("insert into items(order_code,med_id,name,schedule,qty,price,conf,status,approved_by,reason) values(?,?,?,?,?,?,?,?,?,?)", code, m["id"], m["name"], m["schedule"], n, m["price"], 1.0, "approved", None, "")
    settle(code); ex("update orders set verified_at=null where code=?", code)  # no pharmacist step, so it stays out of verification times
    log(u["name"], "cart_order", code); return {"code": code}
@app.get("/api/profiles")
def profiles(u=Depends(auth)): need(u, "customer"); return q("select * from profiles where customer_id=?", u["id"])
class Profile(BaseModel): name: str; relation: str = "Family"
@app.post("/api/profiles")
def add_profile(b: Profile, u=Depends(auth)):
    need(u, "customer"); n = b.name.strip()[:60]
    if not n: raise HTTPException(422, "Enter a name")
    if q("select 1 x from profiles where customer_id=? and name=?", u["id"], n, one=True): raise HTTPException(409, "This person is already added")
    ex("insert into profiles(customer_id,name,relation) values(?,?,?)", u["id"], n, b.relation.strip()[:30]); return {"ok": True}
@app.get("/api/notes")
def notes(u=Depends(auth)): need(u, "customer"); return q("select * from notes where customer_id=? order by ts desc limit 10", u["id"])
@app.post("/api/reminders/run")
def run_reminders(u=Depends(auth)):
    need(u, "pharmacist"); n = 0; today = date.today().isoformat()  # mock of the daily job; messages stay in the app
    for r in q("select r.*, m.name from refills r join meds m on m.id=r.med_id"):
        left = (date.fromisoformat(r["last_filled"]) + timedelta(days=r["qty"] // r["per_day"]) - date.today()).days
        if left <= 5 and not q("select 1 x from notes where customer_id=? and day=? and text like ?", r["customer_id"], today, f"%{r['name']}%{r['for_name']}%", one=True):
            ex("insert into notes values(?,?,?,?)", r["customer_id"], f"{r['name']} for {r['for_name']} runs out in about {max(left, 0)} days. Reorder in one tap.", int(time.time()), today); n += 1
    log(u["name"], "run_reminders", f"{n} sent"); return {"sent": n}
@app.get("/")
def home(): return FileResponse("static/index.html")

def seed_images():  # sample orders get a synthetic prescription so the side-by-side screen is never empty
    for code, kind in [("RX-50211", "s50211"), ("RX-50214", "s50214"), ("RX-50219", "blurry")]:
        o = q("select rx_file from orders where code=?", code, one=True)
        if o and not o["rx_file"]:
            open(f"{STORE}/{code}.enc", "wb").write(Fernet(FKEY).encrypt(demo_png(kind))); ex("update orders set rx_file=? where code=?", f"{code}.enc", code)
seed_images()
