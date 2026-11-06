import difflib
from database.session import q

# The medicine catalogue used for the demo. Prices are sample prices in rupees.
# Schedules follow the Drugs and Cosmetics Rules as best understood; a registered pharmacist should confirm
# them before any real use. They are data, not code: the rules about what each schedule allows are in rules.py.
#
# (id, name, schedule, price, category). Names read "<medicine and strength>, <pack>".
CATALOG = [
    # Diabetes
    (1, "Metformin 500 mg, strip of 15", "H", 120, "Diabetes"),
    (5, "Glimepiride 1 mg, strip of 10", "H", 85, "Diabetes"),
    (12, "Metformin 1000 mg SR, strip of 10", "H", 95, "Diabetes"),
    (13, "Gliclazide 80 mg, strip of 10", "H", 70, "Diabetes"),
    (14, "Glimepiride 2 mg, strip of 10", "H", 110, "Diabetes"),
    (15, "Sitagliptin 100 mg, strip of 7", "H", 320, "Diabetes"),
    # Blood pressure
    (2, "Telmisartan 40 mg, strip of 10", "H", 285, "Blood pressure"),
    (4, "Amlodipine 5 mg, strip of 15", "H", 60, "Blood pressure"),
    (16, "Losartan 50 mg, strip of 15", "H", 110, "Blood pressure"),
    (17, "Telmisartan 80 mg, strip of 10", "H", 340, "Blood pressure"),
    (18, "Amlodipine 10 mg, strip of 15", "H", 95, "Blood pressure"),
    (19, "Metoprolol 50 mg, strip of 15", "H", 90, "Blood pressure"),
    # Cholesterol
    (20, "Atorvastatin 10 mg, strip of 15", "H", 145, "Cholesterol"),
    (21, "Atorvastatin 20 mg, strip of 15", "H", 210, "Cholesterol"),
    (22, "Rosuvastatin 10 mg, strip of 15", "H", 240, "Cholesterol"),
    # Thyroid
    (3, "Levothyroxine 50 mcg, bottle of 100", "H", 190, "Thyroid"),
    (23, "Levothyroxine 25 mcg, bottle of 100", "H", 150, "Thyroid"),
    (24, "Levothyroxine 100 mcg, bottle of 100", "H", 240, "Thyroid"),
    (25, "Carbimazole 5 mg, strip of 10", "H", 60, "Thyroid"),
    # Heart
    (26, "Clopidogrel 75 mg, strip of 15", "H", 180, "Heart"),
    (27, "Isosorbide mononitrate 20 mg, strip of 10", "H", 75, "Heart"),
    # Stomach
    (28, "Pantoprazole 40 mg, strip of 15", "H", 130, "Stomach"),
    (29, "Oral rehydration salts, box of 10 sachets", "OTC", 70, "Stomach"),
    (30, "Antacid suspension, bottle of 170 ml", "OTC", 95, "Stomach"),
    # Antibiotics (Schedule H1: need the prescriber and patient written in a register)
    (31, "Azithromycin 500 mg, strip of 3", "H1", 110, "Antibiotics"),
    (32, "Cefixime 200 mg, strip of 10", "H1", 160, "Antibiotics"),
    # Sleep and anxiety (Schedule H1)
    (6, "Alprazolam 0.25 mg, strip of 10", "H1", 40, "Sleep and anxiety"),
    (33, "Clonazepam 0.5 mg, strip of 10", "H1", 55, "Sleep and anxiety"),
    # Pain and fever
    (7, "Paracetamol 500 mg, strip of 10", "OTC", 30, "Pain and fever"),
    (34, "Paracetamol 650 mg, strip of 15", "OTC", 45, "Pain and fever"),
    # Cold and cough
    (35, "Cough lozenges, pack of 12", "OTC", 60, "Cold and cough"),
    (36, "Saline nasal drops, bottle of 10 ml", "OTC", 55, "Cold and cough"),
    # Vitamins and minerals
    (37, "Vitamin C 500 mg chewable, strip of 15", "OTC", 70, "Vitamins and minerals"),
    (38, "Multivitamin tablets, strip of 15", "OTC", 120, "Vitamins and minerals"),
    (39, "Calcium and vitamin D3, strip of 15", "OTC", 150, "Vitamins and minerals"),
    (40, "Zinc 20 mg dispersible, strip of 10", "OTC", 50, "Vitamins and minerals"),
    # First aid
    (41, "Povidone-iodine 5% ointment, tube of 20 g", "OTC", 65, "First aid"),
    (42, "Adhesive bandages, box of 20", "OTC", 55, "First aid"),
    (43, "Digital thermometer, 1 piece", "OTC", 199, "First aid"),
    # Never sold online. Named "Demo" so nobody mistakes them for real products.
    (8, "Demo Restricted-X 10 mg, strip of 10", "X", 0, "Restricted"),
    (9, "Demo Narcotic 5 mg, strip of 10", "NARC", 0, "Restricted"),
]

# Cheaper generic versions. Only a pharmacist can offer one, and the customer must agree.
# (id, name, schedule, price, generic_of, category)
GENERICS = [
    (10, "Metformin 500 mg (generic), strip of 15", "H", 80, 1, "Diabetes"),
    (11, "Telmisartan 40 mg (generic), strip of 10", "H", 190, 2, "Blood pressure"),
    (50, "Amlodipine 5 mg (generic), strip of 15", "H", 35, 4, "Blood pressure"),
    (51, "Glimepiride 1 mg (generic), strip of 10", "H", 50, 5, "Diabetes"),
    (52, "Atorvastatin 10 mg (generic), strip of 15", "H", 85, 20, "Cholesterol"),
    (53, "Losartan 50 mg (generic), strip of 15", "H", 65, 16, "Blood pressure"),
    (54, "Pantoprazole 40 mg (generic), strip of 15", "H", 75, 28, "Stomach"),
    (55, "Levothyroxine 50 mcg (generic), bottle of 100", "H", 120, 3, "Thyroid"),
]

# The groups a customer can browse, in the order they are shown
CATEGORIES = [
    "Pain and fever",
    "Cold and cough",
    "Vitamins and minerals",
    "Stomach",
    "First aid",
    "Diabetes",
    "Blood pressure",
    "Cholesterol",
    "Thyroid",
    "Heart",
    "Antibiotics",
    "Sleep and anxiety",
]

# The first nine, as the seed and the sample orders have always used them
_FIRST = {1, 2, 3, 4, 5, 6, 7, 8, 9}
MEDS = [(i, n, s, p) for (i, n, s, p, _c) in sorted(CATALOG) if i in _FIRST]


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
