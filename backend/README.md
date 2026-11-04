# RefillCare Backend API

High-performance Python backend built with **FastAPI** for the RefillCare pharmacy reordering and verification platform.

## Features
- **Regulatory Gate:** Enforces Drugs and Cosmetics Act Schedule H/H1 validation via pure business rules in `rules.py`. Blocks unapproved dispatches with HTTP 403.
- **DPDP Act 2023 Compliance:** Prescriptions encrypted at rest with Fernet (AES-128-CBC with HMAC-SHA256) (`rx_store/`), access logged in an audit log (append-only table; not cryptographically tamper-proof), and minor profiles require verified guardian consent.
- **Store Stock Routing:** Automatically selects the nearest pharmacy holding complete inventory for approved lines from daily stock records (the client's chain has 46 stores; this demo seeds the three stores named in the brief).
- **Automated Startup Seeding:** Auto-detects missing database and seeds sample stores (the client's chain has 46 stores; this demo seeds the three stores named in the brief), chronic patient accounts, sample prescriptions, and medicines on boot.
- **Trilingual Notifications:** Automated refill reminders sent based on remaining days of supply.

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

## Docker

```bash
docker build -t refillcare-backend .
docker run -p 8000:8000 -e APP_SECRET=your-secret refillcare-backend
```
