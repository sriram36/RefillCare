# RefillCare Deployment & Operations Guide

RefillCare is an end-to-end pharmacy reorder and verification system built for a 46-store chain across Kolkata and Howrah.
It features a dedicated **Next.js 14 App Router frontend** and a high-performance **FastAPI backend** with DPDP Act encryption, Drugs & Cosmetics Act Schedule H/H1 regulatory gates, and automated stock routing.

---

## 1. System Architecture

```
+-------------------------------------------------------------+
|             Frontend (Next.js 14 + Tailwind CSS)           |
|  - Customer Portal: 1-Tap Refills, Prescription OCR draft  |
|  - Pharmacist Verification: Side-by-Side Review, H1 Reg     |
|  - Store Fulfillment: Hard Regulatory Gate, Pack & Dispatch |
|  - Central Dashboard: 46-Store SLA Tracker, Stock CSV       |
|  Hosted on: Vercel or Render Static Site                    |
+-------------------------------------------------------------+
                               |
                        HTTP / JSON API
                     (CORS Authenticated)
                               v
+-------------------------------------------------------------+
|                Backend API (FastAPI + Python 3.12)          |
|  - Fernet AES-128 Encryption for Prescriptions              |
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
   - **Root Directory:** Leave empty (root)
   - **Environment / Language:** `Docker`
   - **Plan:** Free ($0/month) or Starter ($7/month)
4. **Environment Variables:**
   - `APP_SECRET`: e.g. `rfcare-kolkata-prod-2026-secret`
   - `RX_ENC_KEY`: (optional, auto-generated if omitted)
   - `AZURE_OPENAI_ENDPOINT`: (optional for live OCR)
   - `AZURE_OPENAI_KEY`: (optional)
   - `AZURE_OPENAI_DEPLOYMENT`: (optional)
5. Click **Create Web Service**.
6. Render builds the Docker image and starts the server on `https://refillcare.onrender.com`.

---

## 4. Deploying the Next.js Frontend

The modern frontend is located in `/frontend`. It can be deployed to **Vercel** or **Render Static Site**.

### Deploying on Vercel (Recommended for Next.js)
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import repository `sriram36/RefillCare`.
3. Configure Project Settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** Select `frontend` (or click Edit and select `frontend`).
4. **Environment Variables:**
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://refillcare.onrender.com`
5. Click **Deploy**.
   Vercel will compile the Next.js App Router project and assign a custom URL (e.g. `https://refillcare-frontend.vercel.app`).

### Deploying on Render (Static Site)
1. On Render Dashboard -> **New** -> **Static Site**.
2. Select repository `sriram36/RefillCare`.
3. Set:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Publish Directory:** `out` (or configure Web Service with `npm run start`)
   - **Environment Variable:** `NEXT_PUBLIC_API_URL=https://refillcare.onrender.com`

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

### Backend Unit & Integration Tests (20/20)
```bash
python -m pytest backend/tests -q
```

### Frontend Production Build
```bash
cd frontend
npm run build
```
