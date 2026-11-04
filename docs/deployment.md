# RefillCare Deployment & Operations Guide

RefillCare is an end-to-end pharmacy reorder and verification system built for a 46-store chain across Kolkata and Howrah.
It features a dedicated **Next.js 14 App Router frontend** and a high-performance **FastAPI backend** with DPDP Act encryption, Drugs & Cosmetics Act Schedule H/H1 regulatory gates, and automated stock routing.

- **Live Web Application:** [https://refillcare.vercel.app](https://refillcare.vercel.app)
- **Backend API & Swagger Docs:** [https://refillcare.onrender.com/docs](https://refillcare.onrender.com/docs)
- **GitHub Repository:** [https://github.com/sriram36/RefillCare](https://github.com/sriram36/RefillCare)

---

## Try This in 3 Minutes

Reviewers can verify the core regulatory gates and workflows in under 3 minutes on the live deployment:
- **Demo OTP:** `123456` across all pre-seeded demo accounts.

1. **Verify the Schedule H Regulatory Gate (403 Block)**
   - Click the 1-tap login for **Behala Store Staff** (`9000000082`).
   - Notice order `RX-50214` (Telmisartan 40 mg, Schedule H) has a disabled button: *"Awaiting Pharmacist Check"*.
   - Attempting to pack or dispatch without registered pharmacist approval is strictly blocked by the backend with HTTP `403 APPROVAL_REQUIRED`.
2. **Review Prescription & Doctor License as Pharmacist**
   - Sign out and click 1-tap login for **Anita Rao (Pharmacist)** (`9000000099`).
   - In the verification queue, review `RX-50214` side-by-side with the prescription viewer, inspect the doctor's WBMC registration check badge, and click **Approve Line**.
   - Notice how generic bioequivalent substitution (Janaushadhi) can be offered with 1 click.
3. **Inspect the 46-Store Executive Dashboard**
   - Click the **Central Operations** tab in the top header.
   - View real-time fulfillment KPIs across all 46 Kolkata & Howrah locations, verification SLA (< 10 min vs target), stock levels, and drop-off prevention metrics.

---

## 1. System Architecture

```
+-------------------------------------------------------------+
|             Frontend (Next.js 14 + Tailwind CSS)           |
|  - Customer Portal: 1-Tap Refills, Prescription OCR draft  |
|  - Pharmacist Verification: Side-by-Side Review, H1 Reg     |
|  - Store Fulfillment: Hard Regulatory Gate, Pack & Dispatch |
|  - Central Dashboard: 46-Store SLA Tracker, Stock CSV       |
|  Hosted on: Vercel (https://refillcare.vercel.app)          |
+-------------------------------------------------------------+
                               |
                        HTTP / JSON API
                     (CORS Authenticated)
                               v
+-------------------------------------------------------------+
|                Backend API (FastAPI + Python 3.10+)         |
|  - Fernet (AES-128-CBC with HMAC-SHA256) for Prescriptions   |
|  - Automated 46-Store Stock Routing Engine                  |
|  - DPDP Act 2023 Access Logs & Minor Consent Protection     |
|  - Automated Startup Database Seeding                       |
|  Hosted on: Render Web Service (Docker)                     |
+-------------------------------------------------------------+
```

---

## 2. Docker & Automated Seed Data Loading

### How Seed Data Loads Automatically in Docker
The Docker container automatically seeds the database on startup:
1. `pharmacy.db` and `rx_store/` are excluded from the Docker build via `.dockerignore`.
2. When the Docker container starts, `app.py` runs `init()`.
3. Seeing that no database exists on the first boot, `init()`:
   - Creates all tables (`SCHEMA`).
   - Seeds all **46 stores** across Kolkata & Howrah.
   - Seeds regular patients: **Debasish Ghosh** (diabetes / Metformin), **Rina Sen** (blood pressure / Telmisartan), and **Arif Mondal** (thyroid / Levothyroxine).
   - Seeds store staff and registered pharmacist Anita Rao.
   - Seeds all medicines (Schedule H, Schedule H1, Generics, OTC, and restricted Schedule X/Narcotics blocklist).
   - Seeds store inventory across all stores.
   - Calls `seed_images()` to generate and encrypt initial synthetic sample prescriptions (`RX-50211`, `RX-50214`, `RX-50219`).

### Running via Docker Locally
```bash
# Build the Docker image
docker build -t refillcare-backend .

# Run the container (bind to port 8000)
docker run -p 8000:8000 -e APP_SECRET=your-secure-secret refillcare-backend
```

Open `http://localhost:8000/docs` to explore the OpenAPI documentation.

---

## 3. Deploying the Backend to Render

### Option A: Via Docker (Pre-configured `Dockerfile`)
1. Go to [Render Dashboard](https://dashboard.render.com/) -> **New** -> **Web Service**.
2. Connect your GitHub repository: `sriram36/RefillCare`.
3. Configure the service:
   - **Name:** `refillcare` (or `refillcare-backend`)
   - **Region:** Singapore or Oregon
   - **Branch:** `main`
   - **Root Directory:** Leave empty (uses root `Dockerfile`) or set to `backend` (uses `backend/Dockerfile`)
   - **Environment / Language:** `Docker`
   - **Plan:** Free ($0/month) or Starter ($7/month)
4. **Environment Variables:**
   - `APP_SECRET`: `<generate a long random value; never commit it>`
   - `RX_ENC_KEY`: (optional, auto-generated from APP_SECRET if omitted)
   - `AZURE_OPENAI_ENDPOINT`: (optional for live OCR)
   - `AZURE_OPENAI_KEY`: (optional)
   - `AZURE_OPENAI_DEPLOYMENT`: (optional)
5. Click **Create Web Service**.
6. Render builds the Docker image and starts the server on `https://refillcare.onrender.com`.

---

## 4. Deploying the Next.js Frontend

The modern frontend is located in `/frontend`. It is deployed on **Vercel**.

### Deploying on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import repository `sriram36/RefillCare`.
3. Configure Project Settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
4. **Environment Variables:**
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://refillcare.onrender.com`
5. Click **Deploy**.
   Vercel compiles the Next.js App Router project and assigns the production URL: `https://refillcare.vercel.app`.

---

## 5. Local Development Workflow

### Running Backend (Terminal 1)
```bash
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

### Running Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 6. Pre-seeded Demo Logins

All accounts use the demo OTP: `123456`

| Persona | Name / Store | Phone | Primary Role / Action |
|---|---|---|---|
| **Customer** | Debasish Ghosh | `9000000001` | 1-tap reorder (Metformin for Mother, 4 days left) |
| **Customer** | Rina Sen | `9000000002` | Telmisartan refill, generic substitute consent |
| **Customer** | Arif Mondal | `9000000003` | Levothyroxine (prescription re-upload on hold) |
| **Pharmacist** | Anita Rao | `9000000099` | Verification queue, Schedule H1 approval, Generics |
| **Store Staff** | Salt Lake Store | `9000000081` | Fulfillment, invoice generation, courier dispatch |
| **Store Staff** | Behala Store | `9000000082` | Proves regulatory gate (dispatch blocked) |
| **Store Staff** | Howrah Store | `9000000083` | Routed store fulfillment |

---

## 7. Verification & Testing

### Backend Unit & Integration Tests (34/34 passing)
```bash
cd backend
python -m pytest tests -q
```

### Automated End-to-End Smoke Test
Run against the live Vercel deployment:
```bash
node e2e/smoke.js https://refillcare.vercel.app
```
Or against local dev:
```bash
node e2e/smoke.js http://localhost:3000
```

### Frontend Production Build
```bash
cd frontend
npm run build
```
