"""The sample store network and its past orders.

Data only. The stores and the customers are added to any database that lacks them. The past orders are added
only to a fresh or reset demo database, so a real database is never filled with made-up orders."""

import random
import time
from datetime import date, timedelta

from core.config import AREAS
from rules import hav
from services.catalog import CATALOG

# id, name, lat, lng. The first three have staff logins; the rest show how the network grows.
STORES = [
    (1, "Salt Lake", 22.5867, 88.4171),
    (2, "Behala", 22.4985, 88.3118),
    (3, "Howrah Maidan", 22.5800, 88.3250),
    (4, "Garia", 22.4620, 88.3880),
    (5, "Dum Dum", 22.6230, 88.4020),
    (6, "Jadavpur", 22.4990, 88.3700),
    (7, "New Town", 22.5760, 88.4780),
    (8, "Baranagar", 22.6420, 88.3680),
    (9, "Tollygunge", 22.4980, 88.3460),
    (10, "Dhakuria", 22.5110, 88.3680),
    (11, "Santragachi", 22.5830, 88.2870),
    (12, "Belgharia", 22.6480, 88.3820),
    (13, "Rajarhat", 22.6010, 88.4640),
    (14, "Kasba", 22.5180, 88.3850),
    (15, "Thakurpukur", 22.4650, 88.3050),
]

# Customers with a past. They have no demo login screen of their own, but each can sign in with the usual OTP.
HISTORY_CUSTOMERS = [
    (11, "Sunita Das", "9000000011", "en"),
    (12, "Imran Sheikh", "9000000012", "hi"),
    (13, "Meera Nair", "9000000013", "en"),
    (14, "Tapan Roy", "9000000014", "bn"),
    (15, "Farida Begum", "9000000015", "bn"),
    (16, "Kaushik Paul", "9000000016", "en"),
    (17, "Anjali Verma", "9000000017", "hi"),
    (18, "Subrata Bose", "9000000018", "bn"),
]

PRESCRIBERS = ["Dr. A. Banerjee", "Dr. S. Mukherjee", "Dr. R. Chatterjee", "Dr. P. Sinha", "Dr. N. Ghosal"]
REJECTION_REASONS = [
    "The prescription is more than 6 months old.",
    "The doctor's registration number is missing.",
    "The strength is not clear on the prescription.",
    "This medicine is not on the prescription.",
]
COURIERS = ["Store delivery staff", "Local courier"]
HISTORY_ORDERS = 36
FIRST_CODE = 48100


def _nearest_area(lat: float, lng: float) -> str:
    return min(AREAS, key=lambda a: hav(lat, lng, *AREAS[a]))


def build_history(now: int | None = None, seed: int = 7) -> dict:
    """Past orders spread over the last three weeks, plus refills for the customers who placed them.

    Every line is approved by the pharmacist (id 9) or rejected with a reason, and every Schedule H1 line has its
    register entry, so the dashboard's safety figure stays honest."""
    now = now or int(time.time())
    rng = random.Random(seed)
    sellable = [m for m in CATALOG if m[2] in ("OTC", "H", "H1")]
    h1 = [m for m in sellable if m[2] == "H1"]
    rx = [m for m in sellable if m[2] == "H"]
    otc = [m for m in sellable if m[2] == "OTC"]
    # busier stores take more orders: the three with staff first
    weights = [6, 5, 5] + [2] * (len(STORES) - 3)
    days_ago = lambda n: (date.today() - timedelta(days=n)).isoformat()

    orders, items, register, profiles = [], [], [], []
    for n in range(HISTORY_ORDERS):
        code = f"RX-{FIRST_CODE + n}"
        cid, cname, _, _ = rng.choice(HISTORY_CUSTOMERS)
        store = rng.choices(STORES, weights)[0]
        created = now - rng.randint(1, 21) * 86400 - rng.randint(0, 8 * 3600) - 1800
        rejected = n % 9 == 4  # about one in nine
        verify_min = rng.triangular(3, 13, 6)
        verified = created + int(verify_min * 60)

        picks = rng.sample(rx, rng.randint(1, 2))
        if n % 6 == 2:
            picks.append(rng.choice(h1))
        if n % 5 == 1:
            picks.append(rng.choice(otc))
        total_lines = []
        for med in picks:
            med_id, name, schedule, price, _ = med
            qty = rng.randint(1, 4)
            if rejected:
                total_lines.append((code, med_id, name, schedule, qty, price, 0.55, "rejected", None, rng.choice(REJECTION_REASONS)))
            else:
                total_lines.append((code, med_id, name, schedule, qty, price, round(rng.uniform(0.86, 0.99), 2), "approved", 9, ""))
        items.extend(total_lines)

        if rejected:
            orders.append((code, cid, cname, "rejected", None, None, "", created, verified, None,
                           "cod", 0, _nearest_area(store[2], store[3]), None, None))
            continue

        pay = rng.choice(["cod", "upi"])
        orders.append((code, cid, cname, "dispatched", store[0], None, "", created, verified, f"INV-{store[0]:02d}{n + 100}",
                       pay, 1 if pay == "upi" or rng.random() < 0.8 else 0, _nearest_area(store[2], store[3]),
                       f"TEST-{code}" if pay == "upi" else None, rng.choice(COURIERS)))
        for line in total_lines:
            if line[3] == "H1":
                register.append((code, line[1], rng.choice(PRESCRIBERS), cname, line[4], verified))

    refills = []
    for i, (cid, cname, _, _) in enumerate(HISTORY_CUSTOMERS):
        med = rx[i % len(rx)]
        per_day = 1 + (i % 2)
        qty = 30 * per_day
        refills.append((cid, cname, med[0], qty, per_day, days_ago(8 + i)))  # runs out in 22 days or more
        profiles.append((cid, cname, "Self"))
    return {"orders": orders, "items": items, "register": register, "refills": refills, "profiles": profiles}
