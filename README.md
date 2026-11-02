# RefillCare

A reliable, privacy-first online pharmacy reordering application designed for pharmacy chains. Built with FastAPI, SQLite, and vanilla HTML/JS.

- **Repository:** [https://github.com/sriram36/RefillCare](https://github.com/sriram36/RefillCare)
- **Live Demo:** `<add URL if deployed>`

---

## Key Features

1. **Safety Gate (Schedule H/H1 Enforcement):**
   - Strictly enforces that Schedule H/H1 prescription medicines can **never** be packed or dispatched without explicit approval by a registered pharmacist.
   - Restricts Schedule X and narcotic items from ever being sold online.
   - Enforced server-side via `can_dispatch()` returning HTTP 403 `APPROVAL_REQUIRED` on any unauthorized attempt.

2. **AI-Assisted Prescription Reading (Draft Only):**
   - Reads uploaded prescription images via Azure OpenAI vision models and extracts medication lines as a draft.
   - Matches lines to catalog entries using fuzzy matching; flags confidence below 75% in amber.
   - The pharmacist always reviews side-by-side with the decrypted prescription image before deciding.

3. **Three Role Portals:**
   - **Customer:** One-tap reorder for medicines running low, family profile management, OTC search & cart, multi-language support (English, বাংলা, हिन्दी).
   - **Pharmacist:** Side-by-side queue review, line-by-line approval/rejection, generic medicine substitution offers, controlled substances (H1) register, and central operations dashboard.
   - **Store Staff:** Scoped to individual retail stores, packs approved orders with invoice numbers, and manages handover to delivery.

4. **Nearest-Store Inventory Routing:**
   - Automatically routes approved orders to the nearest store holding full stock for all approved lines based on customer delivery area coordinates.

---

## Quickstart

### Prerequisites
- Python 3.10 or newer

### Local Setup
```bash
# 1. Clone the repository
git clone https://github.com/sriram36/RefillCare.git
cd RefillCare

# 2. Create and activate a virtual environment
# Windows:
python -m venv .venv
.\.venv\Scripts\activate
# Mac/Linux:
python3 -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the application
python -m uvicorn app:app --port 8000 --reload
```

Open **[http://localhost:8000](http://localhost:8000)** in your browser. Sample database and test data are created automatically on first run.

---

## Demo Credentials

All accounts use the demo OTP: **`123456`**.

| Role | Phone | Notes |
|---|---|---|
| Customer (Debasish Ghosh) | `9000000001` | Has active refill for Metformin running low |
| Customer (Rina Sen) | `9000000002` | Order `RX-50214` in progress |
| Pharmacist (Anita Rao) | `9000000099` | Side-by-side queue and operations dashboard |
| Store Staff (Salt Lake) | `9000000081` | Scoped to Store 1 |
| Store Staff (Behala) | `9000000082` | Scoped to Store 2 |
| Store Staff (Howrah Maidan) | `9000000083` | Scoped to Store 3 |

---

## Testing

```bash
# Run backend safety gate & business rule tests (20 tests)
python -m pytest -q

# Run frontend simulated DOM smoke tests (10 checks)
node tests/ui_smoke.js
```

---

## Docker & Deployment

```bash
# Build Docker image
docker build -t refillcare .

# Run container
docker run -p 8000:8000 -e APP_SECRET="your-strong-random-secret" refillcare
```

### Environment Variables
- `APP_SECRET` (Required in production): Secret key for HMAC token signing and encryption key derivation.
- `AZURE_OPENAI_ENDPOINT` (Optional): Base endpoint for Azure OpenAI service.
- `AZURE_OPENAI_KEY` (Optional): API key for Azure OpenAI service.
- `AZURE_OPENAI_DEPLOYMENT` (Optional): Deployment name (e.g. `gpt-5.6-luna`).
- `RX_ENC_KEY` (Optional): Dedicated Fernet encryption key for prescriptions.
- `DB_PATH` (Optional): Path to SQLite database file (defaults to `pharmacy.db`).

---

## Project Documentation
- [Product Requirements Document (PRD.md)](PRD.md)
- [Technical Design Document (TDD.md)](TDD.md)
- [Deployment Guide (deployment.md)](deployment.md)
