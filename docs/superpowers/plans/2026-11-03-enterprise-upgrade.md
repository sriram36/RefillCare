# Enterprise & Production Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade RefillCare to an enterprise-grade, cloud-ready healthcare platform with dual PostgreSQL/SQLite persistence, Azure Blob/S3 encrypted prescription storage, enhanced Azure OpenAI Vision OCR with doctor registry verification, Razorpay UPI payment integration, recurring chronic subscriptions, store-to-store stock transfers, live delivery tracking, and full DPDP Act compliance.

**Architecture:** 
1. **Persistence & Data Layer:** Upgrade `backend/database/session.py` and `config.py` to support `DATABASE_URL` (PostgreSQL in production on Render/Supabase with connection pooling) while preserving seamless SQLite fallback for local demo and test suites without breaking existing queries.
2. **Encrypted Cloud Storage:** Add `backend/core/storage.py` implementing AES-128 Fernet encryption over cloud blob storage (Azure Blob Storage / AWS S3) with local disk fallback.
3. **AI Vision & Doctor Registry Verification:** Upgrade `backend/services/ocr.py` with Azure OpenAI Vision structured extraction, medical entity parsing, WBMC/NMC registration number validation, and automatic Schedule H/H1 classification.
4. **Chronic Auto-Subscriptions & Store Transfers:** Add `subscriptions` and `transfers` models to support automatic scheduled reorders and store-to-store stock transfer requests from the Central Warehouse.
5. **Payments & Security Hardening:** Add Razorpay UPI order creation and webhook verification endpoint, DPDP Right-to-Erasure ("Forget Me") endpoint, and OWASP security headers.
6. **Frontend Enhancements:** Add interactive Live Delivery Tracking Modal with Kolkata/Howrah map route, Recurring Auto-Refill Subscription manager in CustomerView, and Transfer Request workflow in StoreView.

**Tech Stack:** FastAPI, Python 3.10+, Next.js 14, TypeScript, Tailwind CSS, Lucide Icons, SQLite/PostgreSQL, Azure OpenAI / Blob Storage, Pytest.

**Spec:** Problem statement for Company A, Kolkata (46 stores, 9,000 regular chronic patients, ₹1.33 Cr drop-off recovery, DPDP Act 2023, Drugs & Cosmetics Act Rule 65).

## Global Constraints
- Every API endpoint must remain backward-compatible with existing frontend calls.
- `NEXT_PUBLIC_API_URL` remains the sole source of backend URL (zero hardcoded URLs).
- Drugs & Cosmetics Rule 65 and Schedule H/H1 regulatory gates must never be bypassed or weakened.
- All 20 existing pytest tests must remain green alongside new tests.
- Prescriptions must remain encrypted at rest (AES-128 Fernet) across both local disk and Azure Blob Storage.
- Bengali (`bn`), Hindi (`hi`), and English (`en`) localization must be supported across all new UI components.

## Review Focus
1. **Database Fallback:** If `DATABASE_URL` is unset or PostgreSQL connection fails, the system must smoothly fall back to local SQLite with WAL mode without crashing.
2. **Azure Vision Degradation:** When Azure OpenAI keys are not configured or rate-limited, OCR must fall back cleanly to demo extraction or manual pharmacist review without dropping the order.
3. **Regulatory Hard Gate on Stock Transfers:** Inventory transferred between stores must still enforce pharmacist verification before packing.
4. **Subscription Idempotency:** The recurring auto-refill engine must not create duplicate orders for the same billing cycle.
5. **DPDP Right to Erasure:** When a user requests data deletion, active in-flight orders must be handled gracefully without violating the statutory 2-year Schedule H1 prescription retention law.

---

### Task 1: Dual PostgreSQL / SQLite Persistence Engine
**Files:**
- Modify: `backend/core/config.py`
- Modify: `backend/database/session.py`
- Create: `backend/tests/test_persistence.py`

**Interfaces:**
- Consumes: `os.getenv("DATABASE_URL")`
- Produces: `q(sql, *args, one=False)`, `ex(sql, *args)`, `ensure_schema()`, `is_postgres()`

- [ ] **Step 1: Write tests for database connection, query execution, and fallback**
- [ ] **Step 2: Run test to verify initial behavior**
- [ ] **Step 3: Implement PostgreSQL connection pool + SQLite WAL fallback in `session.py`**
- [ ] **Step 4: Run test to verify dual-engine support passes**
- [ ] **Step 5: Commit changes**

---

### Task 2: Encrypted Cloud Blob Storage (Azure Blob / S3 / Local Disk)
**Files:**
- Create: `backend/core/storage.py`
- Modify: `backend/routers/orders.py`
- Modify: `backend/routers/pharmacist.py`
- Test: `backend/tests/test_storage.py`

**Interfaces:**
- Produces: `save_encrypted_rx(filename: str, raw_bytes: bytes) -> str`, `get_decrypted_rx(filename: str) -> bytes`, `delete_rx(filename: str) -> bool`

- [ ] **Step 1: Write test for encrypted write, read-back decryption, and deletion**
- [ ] **Step 2: Run test to verify failure before implementation**
- [ ] **Step 3: Implement `core/storage.py` with Azure Blob Storage + Fernet AES-128 encryption**
- [ ] **Step 4: Update order prescription upload and pharmacist review endpoints to use `storage.py`**
- [ ] **Step 5: Run tests to verify passing**
- [ ] **Step 6: Commit changes**

---

### Task 3: Azure OpenAI Vision Prescription Extraction & Doctor License Verification
**Files:**
- Modify: `backend/services/ocr.py`
- Modify: `backend/rules.py`
- Test: `backend/tests/test_ocr_vision.py`

**Interfaces:**
- Produces: `extract(raw: bytes, demo: str) -> dict`, `validate_doctor_reg(reg_no: str) -> dict`

- [ ] **Step 1: Write test for structured JSON OCR output and WBMC/NMC registration validation**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement enhanced Azure OpenAI Vision parsing with doctor registration check in `ocr.py`**
- [ ] **Step 4: Add `validate_doctor_reg` helper in `rules.py` checking state medical council formats (WBMC, MMC, DMC, NMC)**
- [ ] **Step 5: Run tests to verify passing**
- [ ] **Step 6: Commit changes**

---

### Task 4: Chronic Auto-Refill Subscriptions Engine
**Files:**
- Modify: `backend/database/session.py` (add `subscriptions` table)
- Create: `backend/routers/subscriptions.py`
- Modify: `backend/app.py` (mount subscriptions router)
- Test: `backend/tests/test_subscriptions.py`

**Interfaces:**
- Produces: `GET /subscriptions`, `POST /subscriptions`, `DELETE /subscriptions/{id}`, `POST /subscriptions/run`

- [ ] **Step 1: Write unit tests for creating subscription, calculating next refill date, and triggering orders**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Add `subscriptions` schema and implement `routers/subscriptions.py`**
- [ ] **Step 4: Run tests to verify passing**
- [ ] **Step 5: Commit changes**

---

### Task 5: Store-to-Store Stock Transfer & Central Warehouse Routing
**Files:**
- Modify: `backend/database/session.py` (add `transfers` table)
- Modify: `backend/routers/store.py`
- Modify: `backend/services/routing.py`
- Test: `backend/tests/test_transfers.py`

**Interfaces:**
- Produces: `GET /transfers`, `POST /transfers/request`, `POST /transfers/{id}/fulfill`

- [ ] **Step 1: Write tests for requesting stock from Central Warehouse / neighboring store**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement multi-store transfer workflow in `store.py` and `routing.py`**
- [ ] **Step 4: Run tests to verify passing**
- [ ] **Step 5: Commit changes**

---

### Task 6: Payment Gateway Integration (Razorpay / UPI Intent) & Webhooks
**Files:**
- Create: `backend/services/payments.py`
- Modify: `backend/routers/orders.py`
- Test: `backend/tests/test_payments.py`

**Interfaces:**
- Produces: `create_payment_order(order_code: str, amount: int) -> dict`, `verify_payment_signature(payload: dict) -> bool`

- [ ] **Step 1: Write test for Razorpay order ID creation, mock webhook verification, and status update**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement payment service with Razorpay API and mock simulator in `services/payments.py`**
- [ ] **Step 4: Mount payment creation and webhook endpoints in `routers/orders.py`**
- [ ] **Step 5: Run tests to verify passing**
- [ ] **Step 6: Commit changes**

---

### Task 7: DPDP Act Right-to-Erasure & OWASP Security Hardening
**Files:**
- Modify: `backend/routers/profiles.py`
- Modify: `backend/core/security.py`
- Modify: `backend/app.py`
- Test: `backend/tests/test_security_dpdp.py`

**Interfaces:**
- Produces: `POST /me/forget` (Right to Erasure with statutory medical retention safeguarding)

- [ ] **Step 1: Write test for DPDP data erasure respecting 2-year statutory Schedule H1 retention**
- [ ] **Step 2: Implement data anonymization/erasure endpoint and OWASP security headers in `app.py`**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit changes**

---

### Task 8: Frontend UI Upgrades (Live Map Tracking, Subscriptions, Transfer Hub)
**Files:**
- Create: `frontend/components/LiveTrackingModal.tsx`
- Create: `frontend/components/SubscriptionManager.tsx`
- Modify: `frontend/components/CustomerView.tsx`
- Modify: `frontend/components/StoreView.tsx`
- Modify: `frontend/components/PharmacistView.tsx`
- Modify: `frontend/lib/i18n.ts`

**Interfaces:**
- Produces: Visual delivery vehicle movement on Kolkata/Howrah map, 1-tap auto-refill toggle, store inventory transfer request cards.

- [ ] **Step 1: Implement `LiveTrackingModal.tsx` showing animated GPS progress between store and customer address**
- [ ] **Step 2: Implement `SubscriptionManager.tsx` and embed in `CustomerView.tsx`**
- [ ] **Step 3: Add store inventory transfer request modal and cards in `StoreView.tsx`**
- [ ] **Step 4: Add doctor registration format indicator in `PharmacistView.tsx`**
- [ ] **Step 5: Update `i18n.ts` with English, Bengali, and Hindi translations for new components**
- [ ] **Step 6: Verify frontend static build with `npm run build`**
- [ ] **Step 7: Commit changes**

---

### Task 9: End-to-End Verification & Cloud Deployment Sync
**Files:**
- Modify: `backend/Dockerfile`
- Modify: `README.md`
- Test: All backend tests (`pytest backend/tests`) + frontend build (`npm run build`)

- [ ] **Step 1: Run complete backend pytest suite (all 20 existing + new tests)**
- [ ] **Step 2: Run complete frontend Next.js build verification**
- [ ] **Step 3: Commit and push to `origin/main` to trigger Render backend and Vercel frontend redeployment**
- [ ] **Step 4: Verify live deployments**

