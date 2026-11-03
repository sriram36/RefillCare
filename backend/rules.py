"""Pure business rules: no DB, easy to test. Rules are config (brief: online-pharmacy rules not final)."""

import math
import re

# ASSUMPTION: The brief provides no prescription validity period; 180 days is assumed for chronic refills.
RX_VALID_DAYS = 180

RULES = {
    "OTC": {"rx": False, "blocked": False},
    "H": {"rx": True, "blocked": False},
    "H1": {"rx": True, "blocked": False},
    "X": {"rx": True, "blocked": True},
    "NARC": {"rx": True, "blocked": True},
}


def rule(schedule: str) -> dict:
    """Unknown schedule is treated as prescription-only Schedule H."""
    return RULES.get(schedule, RULES["H"])


def validate_doctor_reg(reg_no: str) -> dict:
    """
    Validate Indian doctor registration number format (WBMC, NMC, MCI, DMC, MMC).
    Returns {"valid": bool, "council": str, "reg_number": str, "formatted": str}
    """
    if not reg_no or not isinstance(reg_no, str):
        return {"valid": False, "council": "Unknown", "reg_number": "", "formatted": ""}

    clean = reg_no.strip().upper()
    if len(clean) < 3:
        return {"valid": False, "council": "Unknown", "reg_number": clean, "formatted": clean}

    council = "State Medical Council"
    if "WBMC" in clean or clean.startswith("WB"):
        council = "West Bengal Medical Council (WBMC)"
    elif "NMC" in clean or "MCI" in clean:
        council = "National Medical Commission (NMC)"
    elif "MMC" in clean:
        council = "Maharashtra Medical Council (MMC)"
    elif "DMC" in clean:
        council = "Delhi Medical Council (DMC)"

    digits = re.findall(r"\d+", clean)
    if digits:
        reg_num = "".join(digits)
        valid = len(reg_num) >= 3
        return {
            "valid": valid,
            "council": council,
            "reg_number": reg_num,
            "formatted": f"{council} #{reg_num}",
        }

    return {"valid": False, "council": council, "reg_number": clean, "formatted": clean}


def can_dispatch(items: list[dict]) -> tuple[bool, str]:
    """
    items: dicts with name, schedule, status (draft/approved/rejected), approved_by.
    Returns: (ok: bool, reason: str)
    """
    live = [i for i in items if i.get("status") != "rejected"]
    for i in live:
        r = rule(i["schedule"])
        if r["blocked"]:
            return False, f"{i['name']}: schedule {i['schedule']} cannot be sold online"
        if r["rx"] and not (i.get("status") == "approved" and i.get("approved_by")):
            return False, f"{i['name']}: pharmacist approval required"
        if i["schedule"] == "H1" and not i.get("registered"):
            return False, f"{i['name']}: H1 register entry missing"
        if i.get("offer") and i.get("consent") is None:
            return False, f"{i['name']}: waiting for the customer's answer on the generic"
    if not live:
        return False, "No approved items on this order"
    return True, ""


def hav(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km between coordinate pairs."""
    p = math.pi / 180
    x = (
        math.sin((lat2 - lat1) * p / 2) ** 2
        + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lng2 - lng1) * p / 2) ** 2
    )
    return 12742 * math.asin(math.sqrt(x))


def route(stores: list[dict], lines: list[tuple[int, int]], lat: float, lng: float) -> dict | None:
    """
    stores: [{id, name, lat, lng, stock: {med_id: qty}}]
    lines: [(med_id, qty)]
    Nearest store holding every line.
    """
    ok = [
        s for s in stores
        if all(s["stock"].get(m, 0) >= n for m, n in lines)
    ]
    return min(ok, key=lambda s: hav(lat, lng, s["lat"], s["lng"])) if ok else None
