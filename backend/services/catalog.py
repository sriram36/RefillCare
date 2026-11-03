import difflib
from database.session import q

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


def match_medicine(text: str):
    names = [m["name"] for m in q("select name from meds where generic_of is null")]
    hit = difflib.get_close_matches(text, [n.split(",")[0] for n in names], 1, 0.6)
    if not hit:
        return None, 0
    matched_med = q(
        "select * from meds where generic_of is null and name like ?",
        hit[0] + "%",
        one=True,
    )
    ratio = difflib.SequenceMatcher(None, text, hit[0]).ratio()
    return matched_med, ratio
