"""Pure business rules: no DB, easy to test. Rules are config (brief: online-pharmacy rules not final)."""
import math
RULES = {"OTC": dict(rx=False, blocked=False), "H": dict(rx=True, blocked=False),
         "H1": dict(rx=True, blocked=False), "X": dict(rx=True, blocked=True),
         "NARC": dict(rx=True, blocked=True)}
def rule(s): return RULES.get(s, RULES["H"])  # unknown schedule -> treated as prescription-only

def can_dispatch(items):
    """items: dicts with name, schedule, status (draft/approved/rejected), approved_by. -> (ok, reason)"""
    live = [i for i in items if i["status"] != "rejected"]
    for i in live:
        r = rule(i["schedule"])
        if r["blocked"]: return False, f"{i['name']}: schedule {i['schedule']} cannot be sold online"
        if r["rx"] and not (i["status"] == "approved" and i["approved_by"]):
            return False, f"{i['name']}: pharmacist approval required"
        if i["schedule"] == "H1" and not i.get("registered"): return False, f"{i['name']}: H1 register entry missing"
        if i.get("offer") and i.get("consent") is None: return False, f"{i['name']}: waiting for the customer's answer on the generic"
    if not live: return False, "No approved items on this order"
    return True, ""

def hav(a, b, c, d):
    p = math.pi / 180
    x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))

def route(stores, lines, lat, lng):
    """stores: [{id,name,lat,lng,stock:{med_id:qty}}], lines: [(med_id, qty)]. Nearest store holding every line."""
    ok = [s for s in stores if all(s["stock"].get(m, 0) >= n for m, n in lines)]
    return min(ok, key=lambda s: hav(lat, lng, s["lat"], s["lng"])) if ok else None
