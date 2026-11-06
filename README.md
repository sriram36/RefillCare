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
│   │   ├── orders.py         # Order lifecycle, search, cart and the dummy payment
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
│   │   └── notifications.py  # SMS / WhatsApp dispatch logging
│   ├── tests/                # 70 automated tests: the approval gate on every order path, stock, payments, ownership, DPDP
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Container configuration for Render
├── frontend/                 # Dedicated Next.js 14 App Router client
│   ├── app/                  # App Router pages (Home, /compliance)
│   ├── components/           # Role-specific views & modals
│   ├── lib/                  # Type-safe API client & trilingual i18n
│   ├── package.json          # Node dependencies
│   └── tailwind.config.js    # Healthcare palette & styling tokens
├── e2e/                      # Automated end-to-end testing
│   └── demo_flow.js          # Walks the whole demo story through the real screens (30 checks, incl. 390px phone)
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
   - **Design:** Warm and calm: sage greens on oat paper with one marigold accent, Young Serif headings and Figtree text (15px body, 48px buttons), the supply shown as a blister strip with one cell per day, and no promotional content. It fits a 390px phone with no sideways scrolling. Customer screens are fully trilingual (English, বাংলা, हिन्दी); `npm run check:i18n` keeps the three dictionaries in step.
   - **Portals:**
     - **Customer App:** a home screen led by one large **Reorder now** button for whatever is running low (&le;5 days of supply), prescription photo upload for who it is for, medicine search and cart (over-the-counter only), 4-step order tracking in plain sentences, reminder messages, the generic-consent prompt, auto-refill, and DPDP rights: download or delete your data.
     - **Pharmacist Queue:** Side-by-side sticky prescription viewer and AI draft match lines, Schedule H1 regulatory register modal, rejection with mandatory reason, and generic savings offer.
     - **Store Staff Screen:** Store-scoped pick and pack workflow with hard regulatory gate preventing dispatch until pharmacist approval, invoice entry, and courier handover.
     - **All-stores dashboard:** orders by store, median verification time against the 10-minute target, rejections with reasons, low-stock alerts (&le; 5 packs), the H1 register, daily stock CSV upload, reminders, and a measured count of items sent without approval (must be 0). The client's chain has 46 stores; this demo seeds the three stores named in the brief.

2. **Backend API (`/backend`):**
   - **Stack:** FastAPI, Python 3.10+, SQLite, Fernet (AES-128-CBC with HMAC-SHA256) encryption. Hosted on **Render Web Service**. PostgreSQL support is unfinished (tables are only created for SQLite), so leave `DATABASE_URL` unset.
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
- Frontend: `http://localhost:3000`. If something already uses port 3000, pick another: `FRONTEND_PORT=3100 docker compose up --build` (PowerShell: `$env:FRONTEND_PORT=3100; docker compose up --build`).
- Backend API & Interactive Docs: `http://localhost:8000/docs`
- Sign in from the **Demo accounts** list (OTP `123456`).
- Data is kept in a Docker volume, so it survives restarts. `docker compose down -v` wipes it and starts fresh.
- The images are built clean: your local `.env`, `pharmacy.db` and prescription files are never copied into them.
- The address your browser uses to reach the backend (`http://localhost:8000`) is set as a build argument in `docker-compose.yml`, because Next.js bakes it in when it builds.

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

#### 2. Start Frontend (in a second terminal)
```bash
cd frontend
npm install

# one time: tell the frontend where the backend is
cp .env.example .env.local        # Windows PowerShell: Copy-Item .env.example .env.local

npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)**. If something else already uses port 3000, run `npm run dev -- -p 3100` and open that port instead.

Sign in from the **Demo accounts** list. If you want to start the story again, press **Restart demo** on the sign-in screen.

#### 3. Check that everything works (optional)
```bash
# backend tests (from backend/, with the virtual environment active)
python -m pytest tests -q

# translations: every key exists in English, Bengali and Hindi (from frontend/)
npm run check:i18n

# the whole demo story through the real screens (from the repo root; needs Chrome)
node e2e/demo_flow.js http://localhost:3000
```

Payment is a dummy: the pay screen is marked *demo*, and pressing Pay only marks the order as paid. No keys or gateway are needed.

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
# 1. Backend safety gate & business rule tests (70 tests)
cd backend
python -m pytest tests -q

# 2. The whole demo story, end to end, through the real UI (needs Chrome; resets the demo data first)
node e2e/demo_flow.js http://localhost:3000

# 3. Translations: every key exists in English, Bengali and Hindi
(cd frontend && npm run check:i18n)

# 4. Frontend production build & typecheck
cd frontend
npm run build
```

---

## Deployment

- **Render Backend Deployment (Docker):** Pre-configured root `Dockerfile` and `backend/Dockerfile` targeting `https://refillcare.onrender.com`.
- **Vercel Frontend Deployment:** Connected `/frontend` directory with environment variable `NEXT_PUBLIC_API_URL=https://refillcare.onrender.com` targeting `https://refillcare.vercel.app`.
- See full step-by-step instructions in **[docs/deployment.md](docs/deployment.md)**.
