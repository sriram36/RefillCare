# RefillCare: Technical Design Document

- **GitHub Repository:** [https://github.com/sriram36/RefillCare](https://github.com/sriram36/RefillCare)
- **Live App (Vercel):** [https://refillcare.vercel.app](https://refillcare.vercel.app)
- **Backend API (Render):** [https://refillcare.onrender.com](https://refillcare.onrender.com)
- **Interactive API Documentation:** [https://refillcare.onrender.com/docs](https://refillcare.onrender.com/docs)
- **Author:** Sriram Kolli · Version: 2.0 (Production Hardened)

---

## 1. Architecture and Rationale

RefillCare is an end-to-end pharmacy reordering platform designed for Company A: the client's chain has 46 stores; this demo seeds the three stores named in the brief (Store 1: Salt Lake, Store 2: Behala, Store 3: Howrah Maidan) along with the central warehouse. The architecture separates user experience and business rules into two decoupled services:

1. **Frontend Client (`/frontend`):**
   - Standalone Next.js 14 application utilizing the App Router, React 18, TypeScript, and Tailwind CSS.
   - Hosted on **Vercel** (`https://refillcare.vercel.app`), configured with zero hardcoded URLs via `NEXT_PUBLIC_API_URL=https://refillcare.onrender.com`.
   - Features role-gated views: Customers and Store Staff each get dedicated, full-screen single-purpose workspaces without cross-role navigation tabs; Pharmacists receive a 2-tab interface (Verification queue ↔ All stores).
   - Fully responsive down to 390px mobile viewports with zero horizontal scrolling.
   - Accessible trilingual localization (English, বাংলা, हिन्दी) across all customer touchpoints.

2. **Backend API Service (`/backend`):**
   - High-performance Python FastAPI service deployed via Docker on **Render** (`https://refillcare.onrender.com`).
   - Pure regulatory and safety business rules live strictly in [`rules.py`](file:///d:/pharmacy-reorder/backend/rules.py) with zero database dependencies, ensuring 100% deterministic test coverage.
   - **Database layer:** [`database/session.py`](../backend/database/session.py) uses SQLite in WAL mode with a 20-second busy timeout, with parameterized queries throughout. It contains a PostgreSQL adapter (`?` translated to `%s`, a connection pool, rollback on error), but **PostgreSQL support is unfinished**: the tables and seed data are only ever created through SQLite, so a fresh Postgres database would be empty. Leave `DATABASE_URL` unset.
   - **Encrypted Blob Storage:** Uploaded prescriptions are encrypted with Fernet (AES-128-CBC with HMAC-SHA256) keys in [`core/storage.py`](file:///d:/pharmacy-reorder/backend/core/storage.py) before writing to cloud blob storage (Azure Blob / S3) with local encrypted disk fallback.
   - OWASP security headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`) are injected on all responses.

---

## 2. Data Model

The schema manages the complete pharmacy reordering lifecycle:

- `users`: `id`, `name`, `phone` (unique), `role` (`customer`, `pharmacist`, `store`), `store_id`, `consent_at`, `token_ver` (defaults to 1).
- `meds`: `id`, `name`, `schedule` (`OTC`, `H`, `H1`, `X`, `NARC`), `price`, `generic_of`.
- `stores`: `id`, `name`, `lat`, `lng` (the client's chain has 46 stores; this demo seeds the three stores named in the brief: Store 1: Salt Lake, Store 2: Behala, Store 3: Howrah Maidan).
- `stock`: `store_id`, `med_id`, `qty` (primary key: `store_id`, `med_id`; refreshed from daily CSV).
- `orders`: `code` (primary key), `customer_id`, `for_name`, `status`, `store_id`, `rx_file`, `note`, `created`, `verified_at`, `invoice_no`, `payment`, `paid`, `area`, `payment_ref`, `delivery_partner`.
- `items`: `id`, `order_code`, `med_id`, `name`, `schedule`, `qty`, `price`, `conf`, `status` (`draft`, `approved`, `rejected`), `approved_by`, `reason`, `offer`, `consent`, `original_price`.
- `prescriptions`: `id`, `customer_id`, `profile_name`, `order_code`, `rx_file`, `approved_at`, `valid_until` (tracks 180-day chronic refill validity).
- `refills`: `id`, `customer_id`, `for_name`, `med_id`, `qty`, `per_day`, `last_filled`.
- `subscriptions`: `id`, `customer_id`, `for_name`, `med_id`, `qty`, `per_day`, `frequency_days`, `next_refill`, `active`, `created` (chronic auto-refill engine).
- `transfers`: `id`, `from_store_id`, `to_store_id`, `med_id`, `qty`, `status`, `requested_at`, `fulfilled_at` (inter-store stock balancing).
- `profiles`: `id`, `customer_id`, `name`, `relation`, `is_minor`, `guardian_consent`.
- `register`: `order_code`, `item_id`, `prescriber`, `patient`, `qty`, `ts` (statutory Rule 65 Schedule H1 register).
- `audit`: `ts`, `actor`, `action`, `entity` (audit log (append-only table; not cryptographically tamper-proof) for DPDP Act compliance).

---

## 3. Main Flows & Safety Gates

### Roles
- `customer`: 1-tap chronic reorders, prescription photo upload, family profile management, DPDP consent grant, data export, and Section 12 *Right to Erasure*.
- `pharmacist`: reviews side-by-side prescription viewer and AI draft items, approves/edits/rejects lines with required statutory reason, validates prescriber license (WBMC/NMC), offers generic bioequivalent alternatives, inspects the central operational dashboard (the client's chain has 46 stores; this demo seeds the three stores named in the brief), and exports the Schedule H1 register.
- `store`: scoped strictly to assigned store location, packs approved orders with physical store invoice entry, and executes courier handover. Store staff are physically prevented from accessing prescription image files.

### The Regulatory Safety Dispatch Gate
The gate is implemented in `rules.can_dispatch(items)` and evaluated on every pack and dispatch attempt:
1. **Schedule H & H1:** Any prescription-only line without registered pharmacist approval immediately blocks the order with HTTP `403 APPROVAL_REQUIRED`.
2. **Schedule X & Narcotics:** Controlled and narcotic substances are rejected immediately during creation and cannot be sold online under any circumstances.
3. **Schedule H1 Register:** Packing an order with an H1 item without prescriber registration details and patient records is blocked.
4. **Generic Substitution Consent:** If a cheaper bioequivalent generic has been offered, the order cannot be packed until the customer affirmatively accepts or declines the offer.

### Prescription Continuity & Re-upload
- When a prescription line is approved, a record is stored in `prescriptions` valid for 180 days (`RX_VALID_DAYS = 180`).
- If an unreadable prescription is uploaded, the order is placed `on_hold`. The customer can re-upload a clearer image directly to the same order via `POST /api/orders/{code}/reupload`.

### DPDP Act 2023 Compliance & Right to Erasure
- First-time sign-in requires explicit plain-language consent outlining data collection and purpose (`POST /api/consent`).
- Minor family profiles require guardian consent.
- Customers can exercise their Section 12 *Right to Erasure* (`POST /api/me/forget`). Personal identifiers, order drafts, and marketing data are purged while statutory Schedule H1 registers are preserved per Rule 65.

---

## 4. AI Vision Prescription Extraction

A multimodal vision model inspects uploaded prescription photos and extracts draft lines:
- **Draft Only:** AI output is strictly an editable suggestion in the pharmacist's verification workbench. It never dispenses or updates inventory autonomously.
- **Fail-safe:** If handwriting is illegible or confidence is low, the order is placed on hold with a customer re-upload notification. If the AI service is unreachable, the pharmacist reads the image manually.
- **Doctor Registration Check:** Doctor registration number: format check only, shown to the pharmacist as information; it does not block dispensing.

---

## 5. UI & Responsive Design

- Built with modern Next.js 14 App Router, React 18, Tailwind CSS, and Lucide icons.
- Mobile-first responsive layouts tested across 1200px desktop viewports and 390px mobile viewports.
- Trilingual support across English, Bengali (বাংলা), and Hindi (हिन्दी) in [`frontend/lib/i18n.ts`](file:///d:/pharmacy-reorder/frontend/lib/i18n.ts).

---

## 6. Assumptions (Labelled)

The following architectural decisions extend beyond the minimal brief to deliver a complete production slice, and are explicitly labelled as assumptions:

- **A1 (Dummy payment):** payment exists only so the screen has something to press. `POST /api/orders/{code}/pay` marks the signed-in customer's own order as paid and returns a made-up reference (`DEMO…`). There is no payment gateway: no keys, no callback, no signature, no money. Only the order's owner can call it, and it refuses orders that are on hold, rejected or already paid.
- **A2 (Doctor Registration Validation):** `rules.validate_doctor_reg` checks the *format* of a registration number (WBMC, NMC, MCI). It is applied to the AI's reading only when live AI reading is configured, and its result is informational: it is not stored and not shown on the pharmacist screen. For Schedule H1 the pharmacist types the prescriber into the register. No connection to any Medical Council registry exists.
- **A3 (Stock Transfers Hub):** Inter-store stock transfer requisitions between local branches and the central warehouse are implemented to solve the client's stockout drop-off problem.
- **A4 (Statutory Compliance Center):** A formal transparency disclosure page (`/compliance`) documents patient rights under the DPDP Act 2023 and Rule 65.
- **A5 (Chronic Auto-Refill Subscriptions):** An automated subscription engine (`/api/subscriptions`) allows recurring refills on 30/60/90 day intervals to prevent the 20% customer churn.
- **A6 (Prescription Validity Period):** In the absence of a stated validity window in the brief, prescriptions are assumed valid for 180 days (`RX_VALID_DAYS = 180` in `rules.py`) for chronic repeat refills.
- **A7 (Mocked Outside Systems):** The following integrations are mocked:
  - Phone OTP: Fixed demo OTP `123456`.
  - SMS / WhatsApp Notifications: reminders are saved and shown under *Messages* in the app, and dispatch is logged via `services.notifications.notify`. Nothing is actually sent.
  - Delivery Partner: Delivery carrier assignment is selected and recorded upon store dispatch.

---

## 7. Honest System Limits

1. **AI Handwriting Accuracy** (a script to measure it on labelled images is in `backend/eval/run_eval.py`): Live Azure OpenAI vision transcription has not been evaluated against real physical Indian doctor prescription slips (tested only on synthetic demo handwriting). Real-world accuracy on unconstrained handwriting remains unmeasured without a labeled real clinical dataset.
2. **Translations:** Bengali and Hindi translations in `i18n.ts` were drafted computationally and require formal clinical review by a native Bengali/Hindi speaker.
3. **Free Hosting Ephemeral Storage & Cold Starts:** The free Render web service tier sleeps after 15 minutes of inactivity (~50-second cold start) and resets ephemeral SQLite disk storage on restart. Permanent storage needs either a paid persistent disk for the SQLite file or finishing the PostgreSQL support (see the database layer note above).
4. **Mocked Outside Systems:** No live SMS, WhatsApp Business API, UPI banking rail, or logistics carrier API is connected; all outside communication and payment flows are safe test simulations.
5. **Languages on staff screens:** the customer screens and reminder messages are in English, Bengali and Hindi. The pharmacist, store and dashboard screens and the privacy page are English only.
6. **Reminders and routing:** reminders run when a pharmacist presses the button, not on a timer. An order is routed to one store that has every item; if none does, the pharmacist is told which medicine is short and stores can request transfers from each other. Three stores are seeded, not 46.

---

## 8. Verification & Testing

- **Backend Automated Tests:** **70 passed tests** (`cd backend && python -m pytest tests -q`). Each test file starts from its own freshly seeded database. `tests/test_safety_gate.py` tries every way of creating an order (upload, refill, subscription, re-upload, cart, generic swap) and checks that none can be packed or dispatched without a pharmacist's approval; it also covers Schedule X and narcotics, stock, payments, order ownership, transfers, the rules file, reminders, the pharmacist adding a line the AI missed, and the dashboard's measured numbers. The safety fixes were mutation-checked: removing each one in turn makes a test fail.
- **End-to-end demo flow:** `node e2e/demo_flow.js <url>` runs the whole demo story through the real screens as each person (30 checks), including the locked store screen, the side-by-side review, Schedule X, the generic consent, the dashboard, reminders, Bengali and Hindi, registering and deleting a new customer, and that no screen scrolls sideways at 390px. It resets the demo data first, so it can be repeated.
- **Translations:** `cd frontend && npm run check:i18n` fails if any language is missing a key, a `{placeholder}` differs, or a value was left in English.
- **Frontend Production Build:** `next build` compiles all 3 static application routes (`/`, `/_not-found`, `/compliance` — 5 static pages total) with 0 errors.
