# RefillCare

A reliable, privacy-first online pharmacy reordering and verification platform designed for the client's 46-store pharmacy chain across Kolkata and Howrah (this demo seeds the three stores named in the brief).

- **Repository:** [https://github.com/sriram36/RefillCare](https://github.com/sriram36/RefillCare)
- **Live App (Vercel):** [https://refillcare.vercel.app](https://refillcare.vercel.app)
- **Backend API (Render):** [https://refillcare.onrender.com](https://refillcare.onrender.com)
- **Interactive Swagger Docs:** [https://refillcare.onrender.com/docs](https://refillcare.onrender.com/docs)

---

## Repository Structure

```
RefillCare/
├── backend/                  # FastAPI Python backend service
│   ├── app.py                # Main API application entrypoint & security headers
│   ├── rules.py              # Pure regulatory safety engine (Schedule H/H1, routing)
│   ├── core/                 # Configuration, security, encryption & storage
│   │   ├── config.py         # Environment configuration & Render guards
│   │   ├── security.py       # Authentication, RBAC, tokens & rate limits
│   │   └── storage.py        # Fernet (AES-128-CBC with HMAC-SHA256) encrypted blob / disk storage
│   ├── database/             # Dual-engine persistence & schema
│   │   ├── session.py        # Postgres / SQLite connection pool & query translation
│   │   └── seed.py           # Auto-seeding stores (the client's chain has 46 stores; this demo seeds the three stores named in the brief), patients, and test orders
│   ├── routers/              # Domain-bounded API route modules
│   │   ├── auth.py           # Login, logout & DPDP consent
│   │   ├── orders.py         # Order lifecycle, search, payments & webhook
│   │   ├── pharmacist.py     # Verification queue, H1 register & approvals
│   │   ├── store.py          # Store fulfillment, dispatch & stock transfers
│   │   ├── subscriptions.py  # Chronic auto-refill subscriptions engine
│   │   ├── refills.py        # Refill calculations & reminders
│   │   ├── profiles.py       # Family profiles & Right to Erasure ("Forget Me")
│   │   └── dashboard.py      # Store network metrics, SLA tracking & CSV sync
│   ├── services/             # Core business & integration services
│   │   ├── ocr.py            # Multimodal prescription extraction & doctor check
│   │   ├── catalog.py        # Medicine catalog & generic mappings
│   │   ├── routing.py        # Nearest-store inventory routing
│   │   ├── payments.py       # Razorpay order generation & HMAC verification
│   │   └── notifications.py  # SMS / WhatsApp dispatch logging
│   ├── tests/                # 34 automated unit & safety gate tests
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Container configuration for Render
├── frontend/                 # Dedicated Next.js 14 App Router client
│   ├── app/                  # App Router pages (Home, /compliance)
│   ├── components/           # Role-specific views & modals
│   ├── lib/                  # Type-safe API client & trilingual i18n
│   ├── package.json          # Node dependencies
│   └── tailwind.config.js    # Healthcare palette & styling tokens
├── e2e/                      # Automated end-to-end testing
│   ├── smoke.js              # Lightweight puppeteer smoke test across all roles
│   └── full_verification.js  # Full multi-role responsive test suite (1200px & 390px)
├── docs/                     # Technical specifications & documentation
│   ├── PRD.md                # Product Requirements Document
│   ├── TDD.md                # Technical Design Document
│   └── deployment.md         # Full deployment & operations runbook
├── Dockerfile                # Root Dockerfile for Render Web Service deployment
├── docker-compose.yml        # Compose file for running full stack locally
└── README.md                 # Project documentation
```

---

## Architecture Overview

RefillCare is organized into two decoupled services:

1. **Modern Frontend (`/frontend`):**
   - **Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons. Hosted on **Vercel**.
   - **Design:** Clean typography, calm healthcare aesthetics, high-contrast accessible states, role switcher, and trilingual support (English, বাংলা, हिन्दी).
   - **Portals:**
     - **Customer App:** 1-tap monthly refills, active "Running Low" chips (&le;5 days supply), live search across stores (the client's chain has 46 stores; this demo seeds the three stores named in the brief), prescription photo upload, 5-stage order tracking, and DPDP Act data rights.
     - **Pharmacist Queue:** Side-by-side sticky prescription viewer and AI draft match lines, Schedule H1 regulatory register modal, rejection with mandatory reason, and generic savings offer.
     - **Store Staff Screen:** Store-scoped pick and pack workflow with hard regulatory gate preventing dispatch until pharmacist approval, invoice entry, and courier handover.
     - **Central Operations Dashboard:** Real-time metrics across stores (the client's chain has 46 stores; this demo seeds the three stores named in the brief), median verification SLA tracker (< 10 min benchmark), low-stock inventory alerts (&le; 5 units), daily stock CSV sync, and automated refill reminders trigger.

2. **Backend API (`/backend`):**
   - **Stack:** FastAPI, Python 3.10+, SQLite (local) / PostgreSQL (production), Fernet (AES-128-CBC with HMAC-SHA256) encryption. Hosted on **Render Web Service**.
   - **Compliance:**
     - Drugs and Cosmetics Act & Rules: Schedule H and H1 medicines require registered pharmacist approval; Schedule X and narcotic items are strictly prohibited online; Schedule H1 sales are logged to a statutory register.
     - DPDP Act 2023: Prescriptions are encrypted at rest with Fernet (AES-128-CBC with HMAC-SHA256), access is logged in an audit log (append-only table; not cryptographically tamper-proof), and minor profiles require explicit guardian consent.
   - **Routing Engine:** Automatically calculates distance from customer delivery area to stores holding complete inventory from daily stock records.
   - **CORS Support:** Full cross-origin resource sharing configured to allow standalone Next.js deployments on Vercel.

---

## Quickstart

### Option A: Run Full Stack via Docker Compose
```bash
git clone https://github.com/sriram36/RefillCare.git
cd RefillCare

docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API & Interactive Docs: `http://localhost:8000/docs`

---

### Option B: Run Locally Without Docker

#### 1. Start Backend
```bash
cd backend

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
The database and sample seed data (the client's chain has 46 stores; this demo seeds the three stores named in the brief: Salt Lake, Behala, Howrah Maidan, sample patients, medicines, and encrypted demo prescriptions) are created automatically on first run.

#### 2. Start Frontend
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
# 1. Backend safety gate & business rule tests (34 tests passed)
cd backend
python -m pytest tests -q

# 2. Automated smoke test (logs in as each role and checks the main screen loads)
node e2e/smoke.js https://refillcare.vercel.app

# 3. Frontend production build & typecheck
cd frontend
npm run build
```

---

## Deployment

- **Render Backend Deployment (Docker):** Pre-configured root `Dockerfile` and `backend/Dockerfile` targeting `https://refillcare.onrender.com`.
- **Vercel Frontend Deployment:** Connected `/frontend` directory with environment variable `NEXT_PUBLIC_API_URL=https://refillcare.onrender.com` targeting `https://refillcare.vercel.app`.
- See full step-by-step instructions in **[docs/deployment.md](docs/deployment.md)**.
