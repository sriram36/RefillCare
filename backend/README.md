# RefillCare Backend API

High-performance Python backend built with **FastAPI** for the RefillCare pharmacy reordering and verification platform.

## Features
- **Regulatory Gate:** Enforces Drugs and Cosmetics Act Schedule H/H1 validation via pure business rules in `rules.py`. Blocks unapproved dispatches with HTTP 403.
- **DPDP Act 2023 Compliance:** Prescriptions encrypted at rest with Fernet (AES-128-CBC with HMAC-SHA256) (`rx_store/`), access logged in an audit log (append-only table; not cryptographically tamper-proof), and minor profiles require verified guardian consent.
- **Store Stock Routing:** Automatically selects the nearest pharmacy holding complete inventory for approved lines from daily stock records (the client's chain has 46 stores; this demo seeds the three stores named in the brief).
- **Automated Startup Seeding:** Auto-detects missing database and seeds sample stores (the client's chain has 46 stores; this demo seeds the three stores named in the brief), chronic patient accounts, sample prescriptions, and medicines on boot.
- **Trilingual Reminders:** refill reminders are worked out from tablets bought and tablets taken a day, written in the customer's saved language (English, Bengali or Hindi), shown in the app, and sent at most once a day per medicine.
- **Configurable rules:** `data/rules.json` sets which schedules need a prescription, which are never sold online, and how long a prescription is valid. A malformed file stops the server on start, so the safety gate can never loosen silently.
- **Payments:** test mode only. The server confirms a test payment for the order's owner. The real gateway webhook checks an HMAC signature and stays closed until `RAZORPAY_WEBHOOK_SECRET` is set.
- **Stock:** packing takes the quantity from the store's count in one step, and refuses with a clear message if the store cannot cover it.

## Local Setup

```bash
cd backend
python -m venv .venv
# Activate:
# Windows: .\.venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate

pip install -r requirements.txt
uvicorn app:app --port 8000 --reload
```

## Running Tests

```bash
python -m pytest tests -q
```
Each test file starts from its own freshly seeded database (`tests/conftest.py`). `tests/test_safety_gate.py` is the one to read first: it tries every way of creating an order and checks that none can be packed without a pharmacist's approval.

## Docker

```bash
docker build -t refillcare-backend .
docker run -p 8000:8000 -e APP_SECRET=your-secret refillcare-backend
```
