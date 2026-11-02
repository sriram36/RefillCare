# RefillCare

A reliable, privacy-first online pharmacy reordering and verification platform designed for a 46-store pharmacy chain across Kolkata and Howrah.

- **Repository:** [https://github.com/sriram36/RefillCare](https://github.com/sriram36/RefillCare)
- **Live Backend API & Demo:** [https://refillcare.onrender.com/](https://refillcare.onrender.com/)

---

## Architecture Overview

RefillCare is architected with a decoupled frontend and backend:

1. **Modern Frontend (`/frontend`):**
   - **Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons.
   - **Experience:** Clean typography (Plus Jakarta Sans), high-contrast accessible states, calm healthcare aesthetics, instant role-switcher, and trilingual support (English, বাংলা, हिन्दी).
   - **Portals:**
     - **Customer App:** 1-tap monthly medicine refills, active "Running Low" alerts, live search across 46 stores, prescription photo upload, 5-stage order tracking, and DPDP Act data rights.
     - **Pharmacist Queue:** Side-by-side sticky prescription viewer and AI draft match lines, Schedule H1 regulatory register modal, rejection with mandatory reason, generic savings offer.
     - **Store Staff Screen:** Store-scoped pick and pack workflow with hard regulatory gate preventing dispatch until pharmacist approval, invoice entry, and courier handover.
     - **Central Operations Dashboard:** Real-time metrics across 46 stores, median verification SLA tracker (< 10 min benchmark), low-stock inventory alerts (&le; 5 units), daily stock CSV sync, and automated refill reminders trigger.

2. **Backend API (`app.py`, `rules.py`):**
   - **Stack:** FastAPI, Python 3.12, SQLite, Fernet AES-128 encryption.
   - **Compliance:**
     - Drugs and Cosmetics Act & Rules: Schedule H and H1 medicines require registered pharmacist approval; Schedule X and narcotic items are strictly prohibited online; Schedule H1 sales are logged to a statutory register.
     - DPDP Act 2023: Prescriptions are encrypted at rest with Fernet AES-128, access is logged in a tamper-evident audit trail, and minor profiles require explicit guardian consent.
   - **Routing Engine:** Automatically calculates distance from customer delivery area to stores holding complete inventory from daily stock records.
   - **CORS Support:** Full cross-origin resource sharing configured to allow standalone Next.js deployments.

---

## Quickstart

### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/sriram36/RefillCare.git
cd RefillCare

# Create and activate virtual environment
# Windows:
python -m venv .venv
.\.venv\Scripts\activate
# Mac/Linux:
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn app:app --port 8000 --reload
```
The SQLite database and sample seed data (46 stores, sample patients, medicines, and encrypted demo prescriptions) are created automatically on first run.

### 2. Modern Next.js Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Demo Credentials

All test accounts authenticate using OTP: **`123456`**.

| Role | Name / Store | Phone | Primary Feature |
|---|---|---|---|
| **Customer** | Debasish Ghosh | `9000000001` | 1-Tap Reorder (Metformin for Mother, 4 days left) |
| **Customer** | Rina Sen | `9000000002` | Telmisartan refill, generic substitute consent |
| **Customer** | Arif Mondal | `9000000003` | Levothyroxine (prescription re-upload on hold) |
| **Pharmacist** | Anita Rao | `9000000099` | Verification queue, Schedule H1 approval, Generics |
| **Store Staff** | Salt Lake Store | `9000000081` | Fulfillment, invoice generation, courier dispatch |
| **Store Staff** | Behala Store | `9000000082` | Proves regulatory gate (dispatch blocked) |
| **Store Staff** | Howrah Maidan | `9000000083` | Routed store fulfillment |

---

## Automated Verification & Tests

```bash
# 1. Backend safety gate & business rule tests (20 tests passed)
python -m pytest -q

# 2. Frontend production build & typecheck
cd frontend
npm run build

# 3. Simulated DOM UI smoke test
node tests/ui_smoke.js
```

---

## Deployment & Docker

- **Docker:** The backend container automatically seeds the database on first boot.
  ```bash
  docker build -t refillcare-backend .
  docker run -p 8000:8000 -e APP_SECRET="your-strong-random-secret" refillcare-backend
  ```
- **Render Backend Deployment:** Pre-configured Docker deployment targeting `https://refillcare.onrender.com`.
- **Vercel / Render Frontend Deployment:** Connect `/frontend` directory with environment variable `NEXT_PUBLIC_API_URL=https://refillcare.onrender.com`.
- See detailed instructions in **[deployment.md](deployment.md)**.

---

## Documentation
- [Product Requirements Document (PRD.md)](PRD.md)
- [Technical Design Document (TDD.md)](TDD.md)
- [Deployment Guide (deployment.md)](deployment.md)
- [Frontend Documentation (frontend/README.md)](frontend/README.md)
