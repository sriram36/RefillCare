# RefillCare Deployment & Operations Guide

RefillCare is an end-to-end pharmacy reorder and verification system built for a chain across Kolkata and Howrah (the client's chain has 46 stores; this demo seeds the three stores named in the brief: Salt Lake, Behala, Howrah Maidan).
It features a dedicated **Next.js 14 App Router frontend** and a high-performance **FastAPI backend** with DPDP Act encryption, Drugs & Cosmetics Act Schedule H/H1 regulatory gates, and automated stock routing.

- **Live Web Application:** [https://refillcare.vercel.app](https://refillcare.vercel.app)
- **Backend API & Swagger Docs:** [https://refillcare.onrender.com/docs](https://refillcare.onrender.com/docs)
- **GitHub Repository:** [https://github.com/sriram36/RefillCare](https://github.com/sriram36/RefillCare)

---

## Try This in 3 Minutes

Sign in with the demo accounts listed under the phone and OTP form. The OTP is `123456`. **Restart demo** (on the sign-in screen) puts everything back to the start, so you can repeat this as often as you like. The full scripted walk-through, with what to say at each step, is in **[DEMO.md](DEMO.md)**.

1. **See that nothing leaves a store before a pharmacist approves it**
   - Sign in as **Behala store**. Order `RX-50214` (Telmisartan, Schedule H) is locked, and its pack button reads *Waiting for the pharmacist*.
   - Even calling the API directly is refused: `POST /api/orders/RX-50214/pack` returns `403 APPROVAL_REQUIRED`.
2. **Check a prescription as the pharmacist**
   - Sign in as **Anita Rao**. Open `RX-50214`. The prescription is on the left and the medicines the AI read are on the right, so you can compare them. Press **Approve**, then **Offer to customer** to propose the cheaper generic. Nothing is swapped until the customer agrees.
3. **Reorder as a customer in one tap**
   - Sign in as **Debasish Ghosh**, agree to the data notice, and press **Reorder now** under *Running low*. It goes to the pharmacist queue.
   - Sign in as **Rina Sen** and use **Send a prescription**. Under *No prescription handy?* pick a sample: *Not sold online* shows a Schedule X line being rejected on sight, and *Blurry* is sent back for a clearer photo.
4. **Look across all stores**
   - As Anita, open the **All stores** tab: median verification time, orders by store, rejections with reasons, low stock, the H1 register, and a measured count of items sent without approval (which must be 0).
5. **See the reminder and the languages**
   - On the dashboard, press **Send today's reminders**. Sign in as Debasish: the message is under *Messages*. Change the language (top right) to বাংলা or हिन्दी.

To run the whole story automatically and check it: `node e2e/demo_flow.js <app url>`.

---

## 1. System Architecture

```
+-------------------------------------------------------------+
|             Frontend (Next.js 14 + Tailwind CSS)           |
|  - Customer Portal: 1-Tap Refills, Prescription OCR draft  |
|  - Pharmacist Verification: Side-by-Side Review, H1 Reg     |
|  - Store Fulfillment: Hard Regulatory Gate, Pack & Dispatch |
|  - Central Dashboard: Store SLA Tracker, Stock CSV         |
|  Hosted on: Vercel (https://refillcare.vercel.app)          |
+-------------------------------------------------------------+
                               |
                        HTTP / JSON API
                     (CORS Authenticated)
                               v
+-------------------------------------------------------------+
|                Backend API (FastAPI + Python 3.10+)         |
|  - Fernet (AES-128-CBC with HMAC-SHA256) for Prescriptions   |
|  - Automated Store Stock Routing Engine                    |
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
   - Seeds sample stores (the client's chain has 46 stores; this demo seeds the three stores named in the brief: Salt Lake, Behala, Howrah Maidan).
   - Seeds regular patients: **Debasish Ghosh** (diabetes / Metformin), **Rina Sen** (blood pressure / Telmisartan), and **Arif Mondal** (thyroid / Levothyroxine).
   - Seeds store staff and registered pharmacist Anita Rao.
   - Seeds all medicines (Schedule H, Schedule H1, Generics, OTC, and restricted Schedule X/Narcotics blocklist).
   - Seeds store inventory across the seeded stores.
   - Calls `seed_images()` to generate and encrypt initial synthetic sample prescriptions (`RX-50211`, `RX-50214`, `RX-50219`).

### Running via Docker Locally
The whole app (frontend and backend) in one command, from the repo root:
```bash
docker compose up --build
```
Frontend on `http://localhost:3000` (set `FRONTEND_PORT` if that port is busy), backend docs on `http://localhost:8000/docs`. Data lives in the `refillcare-data` volume; `docker compose down -v` resets it. Each service has its own `.dockerignore`, so local secrets and patient data (`.env`, `*.db`, `rx_store/`) are never copied into an image.

Just the backend, the same image Render builds:
```bash
docker build -t refillcare-backend .
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
   - `DEMO_MODE`: `true` (default) keeps the one-click **Restart demo** endpoint. **Set `false` for a real deployment**: the endpoint then returns 404.
   - `RULES_FILE`: optional path to a rules file. By default `backend/data/rules.json` sets which schedules need a prescription, which are never sold online, and how long a prescription stays valid. Edit it when the online-pharmacy rules change. A malformed file stops the server on start, so the safety gate can never loosen silently.
   - `CORS_ORIGINS`: comma-separated list of allowed front-end origins. Set it to your Vercel URL in production (the default `*` is for local use).
   - `DATABASE_URL`: **leave unset.** PostgreSQL support is unfinished: the queries are translated, but the tables are only created for SQLite, so a fresh Postgres database would be empty and fail. Use the default SQLite file.
   - `AZURE_OPENAI_ENDPOINT`: `https://rag-42.openai.azure.com` (optional for live Azure Vision)
   - `AZURE_OPENAI_KEY`: `<your-azure-key>` (optional)
   - `AZURE_OPENAI_DEPLOYMENT`: `gpt-5.6-luna` (optional, defaults to `gpt-5.6-luna`)

> [!NOTE]
> When Azure OpenAI credentials are configured, any uploaded prescription photo is processed live by Azure OpenAI Vision (`gpt-5.6-luna`) with automatic line extraction and doctor license validation. When unconfigured, the app seamlessly runs its built-in clinical OCR parser and pharmacist manual review fallback.
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

## 6. Demo Logins & Sign-In

The sign-in screen has a phone number and OTP form (OTP `123456`). Any new 10-digit number creates a fresh customer account with its own order history and its own consent record. Below the form is a **Demo accounts** list for reviewers, with one tap per person, and a **Restart demo** button that calls `POST /api/demo/reset`. The reset restores the sample orders, stock, reminders and the three demo customers' consent. It never deletes the access log, which is the record of who opened which prescription.

| Persona | Phone | What it shows |
|---|---|---|
| **Debasish Ghosh** (customer) | `9000000001` | Mother's Metformin is 4 days from running out: one-tap reorder |
| **Rina Sen** (customer) | `9000000002` | Order waiting for the pharmacist; generic offer; Schedule X sample |
| **Arif Mondal** (customer) | `9000000003` | Prescription sent back as unreadable; re-sends a clearer photo |
| **Anita Rao** (pharmacist) | `9000000099` | Verification queue, H1 register, the all-stores dashboard |
| **Salt Lake / Behala / Howrah Maidan** (store staff) | `9000000081` / `82` / `83` | Pack, enter the invoice number, hand over; the locked state before approval |

---

## 7. Verification & Testing

### Backend tests (66)
```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest tests -q
```
Each test file starts from its own freshly seeded database. `tests/test_safety_gate.py` tries every way of creating an order (upload, refill, subscription, re-upload, cart, generic swap) and checks that none of them can be packed or dispatched without a pharmacist's approval, that Schedule X and narcotics are never sold, and that stock, payments and ownership cannot be bypassed.

### End-to-end demo flow (28 checks)
Needs Chrome (set `CHROME_PATH` if it is not in the usual place). Start the backend and the frontend, then:
```bash
node e2e/demo_flow.js http://localhost:3000
```
It resets the demo data, then walks the whole story through the real screens as each person and fails if any step breaks, or if any screen scrolls sideways on a 390px phone. It can be run repeatedly. Screenshots are saved to `screenshots/demo/`. Against the deployed app, pass the Vercel URL and set `API_URL` to the Render URL.

### Frontend production build
```bash
cd frontend
npm run build
```
