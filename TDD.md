# Technical Design Document: Pharmacy reorder (core build)

GitHub: <add your repo URL>  ·  Live app: <add URL if deployed>

## 1. Architecture and why
FastAPI + SQLite, one service, plain HTML/JS front end. Chosen so the whole core slice runs with one command and a reviewer can try it with no setup. Business rules live in `rules.py` (no DB, easy to test). Postgres and Next.js are the next step, not a different design.

## 2. Data model
users (role), meds (schedule, price), stores, stock (from a daily CSV), orders (state), items (schedule snapshot, confidence, approved_by, reason), refills (quantity, per-day dose, last filled), audit (every upload, view, decision, blocked attempt).

## 3. Main flows
Customer uploads or reorders, then AI draft, then pharmacist approves, edits quantity or rejects with a reason, then routing to the nearest store holding every approved line, then pack, then hand to delivery. Order states: awaiting_pharmacist, on_hold, approved, packed, dispatched, rejected.
**The gate:** `can_dispatch()` runs on every pack and dispatch call, in the backend. Any prescription-only line that is not approved by a pharmacist blocks the order (HTTP 403). Restricted schedules (X, narcotic) are refused when the order is created. Unknown schedules are treated as prescription-only. Rules are a config table in `rules.py`.

## 4. How the AI works
A vision model reads the image and returns lines with confidence. Output is only a draft: each line is matched to the catalog (fuzzy match, never invented); confidence is the lower of the model's and the match score; under 75% is shown in amber. Unreadable images put the order on hold with a re-upload request. If the AI is unavailable or unconfigured, nothing is guessed: the pharmacist reads the image. Prescription images are encrypted at rest and every view is logged.

**Measuring it:** `eval/run_eval.py` scores the reading on labelled prescription images (lines correct, correct but flagged, wrong and confident, unreadable). Run it with your Azure key and paste the numbers here; I have not measured accuracy on real handwriting.
**Testing:** 10 backend tests (gate, routing, consent, H1, roles, validation, reminders) and a UI smoke test in a simulated DOM (`tests/ui_smoke.js`). It is not a real browser.

## 5. UI decisions
Customer: one large Reorder button, refills first, no promotions. Pharmacist: queue on the left, prescription beside the matched lines, one action per line. Plain sentence-case copy, large text, a restrained teal palette, light and dark modes.

## 6. Assumptions (labelled)
- A1: Schedule list and catalog are sample data; "Demo Restricted-X" and "Demo Narcotic" are fictional items.
- A2: The customer picks a delivery area from four sample areas; routing measures distance from that area's sample coordinates (the brief gives no addresses).
- A3: OTP is a fixed demo code; UPI (test mode) only marks the order paid, and messages and delivery are mocked.
- A4: Prescription images in the demo are synthetic.
- A5: Refill is due within 5 days of running out (quantity ÷ daily dose).
- A6: Sessions last 12 hours; the OTP is a fixed demo code.
- A7: Each branded medicine has at most one generic on file (sample pairs); H1 register fields are prescriber, patient and quantity, as the brief names prescriber and patient details.

## 7. Cut, limits and next
Built beyond the core: generic substitutes (pharmacist offers, customer consents, dispatch blocked until answered), H1 register, central dashboard, store invoice number, daily stock CSV upload, family profiles, UPI (test mode) and cash on delivery, routing from a chosen delivery area, refill reminders as in-app messages (a mock of the daily job), 12-hour sessions, English/Bengali/Hindi on the customer home.
Not built: real payment gateway, real SMS/WhatsApp sending, customer street addresses and map pins, store-staff role separate from the pharmacist, search across the full catalog (the demo catalog is small), accuracy measurement on real handwritten prescriptions.
Limits: live Azure OpenAI reading is coded but untested against a real key; Bengali and Hindi strings need a native speaker's review and cover only the customer home; SQLite is single-writer; delivery areas use sample coordinates.
Next: Postgres, translations for every screen, a golden set of real prescription images with measured accuracy, real notifications, a separate store-staff role.
