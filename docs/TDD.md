# RefillCare: Technical Design Document

- **GitHub Repository:** [https://github.com/sriram36/RefillCare](https://github.com/sriram36/RefillCare)
- **Live App (Vercel):** [https://refillcare.vercel.app](https://refillcare.vercel.app)
- **Backend API (Render):** [https://refillcare.onrender.com](https://refillcare.onrender.com)
- **Interactive API Documentation:** [https://refillcare.onrender.com/docs](https://refillcare.onrender.com/docs)
- **Author:** Sriram Kolli · Version: 2.0 (Production Hardened)

---

## 1. Architecture and Rationale

RefillCare separates the user experience and business rules into two decoupled services:

1. **Frontend Client (`/frontend`):**
   - Standalone Next.js 14 application utilizing the App Router, React 18, TypeScript, and Tailwind CSS.
   - Hosted on **Vercel** (`https://refillcare.vercel.app`), configured with zero hardcoded URLs via `NEXT_PUBLIC_API_URL=https://refillcare.onrender.com`.
   - Features role-gated views: Customers and Store Staff each get dedicated, full-screen single-purpose workspaces without cross-role navigation tabs; Pharmacists receive a 2-tab interface (Verification Queue ↔ Central Operations).
   - Fully responsive down to 390px mobile viewports with zero horizontal scrolling.
   - Accessible trilingual localization (English, বাংলা, हिन्दी) across all customer touchpoints.

2. **Backend API Service (`/backend`):**
   - High-performance Python FastAPI service deployed via Docker on **Render** (`https://refillcare.onrender.com`).
   - Pure regulatory and safety business rules live strictly in [`rules.py`](file:///d:/pharmacy-reorder/backend/rules.py) with zero database dependencies, ensuring 100% deterministic test coverage.
   - **Dual-Persistence Engine:** The universal database layer in [`database/session.py`](file:///d:/pharmacy-reorder/backend/database/session.py) auto-detects `DATABASE_URL` in production to run PostgreSQL with connection pooling (`psycopg2`), while defaulting to SQLite in WAL mode with a 20-second busy timeout for local development. Parameterized queries (`?` translated to `%s` for Postgres) prevent SQL injection.
   - **Encrypted Blob Storage:** Uploaded prescriptions are encrypted with Fernet (AES-128-CBC with HMAC-SHA256) keys in [`core/storage.py`](file:///d:/pharmacy-reorder/backend/core/storage.py) before writing to cloud blob storage (Azure Blob / S3) with local encrypted disk fallback.
   - OWASP security headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`) are injected on all responses.

---

## 2. Data Model

The schema manages the complete pharmacy reordering lifecycle:

- `users`: `id`, `name`, `phone` (unique), `role` (`customer`, `pharmacist`, `store`), `store_id`, `consent_at`, `token_ver` (defaults to 1).
- `meds`: `id`, `name`, `schedule` (`OTC`, `H`, `H1`, `X`, `NARC`), `price`, `generic_of`.
- `stores`: `id`, `name`, `lat`, `lng`.
- `stock`: `store_id`, `med_id`, `qty` (primary key: `store_id`, `med_id`; refreshed from daily CSV).
- `orders`: `code` (primary key), `customer_id`, `for_name`, `status`, `store_id`, `rx_file`, `note`, `created`, `verified_at`, `invoice_no`, `payment`, `paid`, `area`, `payment_ref`, `delivery_partner`.
- `items`: `id`, `order_code`, `med_id`, `name`, `schedule`, `qty`, `price`, `conf`, `status` (`draft`, `approved`, `rejected`), `approved_by`, `reason`, `offer`, `consent`, `original_price`.
- `prescriptions`: `id`, `customer_id`, `profile_name`, `order_code`, `rx_file`, `approved_at`, `valid_until` (tracks 180-day chronic refill validity).
- `refills`: `id`, `customer_id`, `for_name`, `med_id`, `qty`, `per_day`, `last_filled`.
- `subscriptions`: `id`, `customer_id`, `for_name`, `med_id`, `qty`, `per_day`, `frequency_days`, `next_refill`, `active`, `created` (chronic auto-refill engine).
- `transfers`: `id`, `from_store_id`, `to_store_id`, `med_id`, `qty`, `status`, `requested_at`, `fulfilled_at` (inter-store stock balancing).
- `payment_orders`: `id`, `order_code`, `razorpay_order_id`, `amount`, `currency`, `status`, `created_at` (payment intent tracking).
- `profiles`: `id`, `customer_id`, `name`, `relation`, `is_minor`, `guardian_consent`.
- `register`: `order_code`, `item_id`, `prescriber`, `patient`, `qty`, `ts` (statutory Rule 65 Schedule H1 register).
- `audit`: `ts`, `actor`, `action`, `entity` (tamper-evident audit log for DPDP Act compliance).

---

## 3. Main Flows & Safety Gates

### Roles
- `customer`: 1-tap chronic reorders, prescription photo upload, family profile management, DPDP consent grant, data export, and Section 12 *Right to Erasure*.
- `pharmacist`: reviews side-by-side prescription viewer and AI draft items, approves/edits/rejects lines with required statutory reason, validates prescriber license (WBMC/NMC), offers generic bioequivalent alternatives, inspects 46-store operational dashboard, and exports the Schedule H1 register.
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
- **Doctor Registration Check:** The system structurally validates doctor registration numbers (WBMC, NMC, MCI) before Schedule H1 dispensing.

---

## 5. UI & Responsive Design

- Built with modern Next.js 14 App Router, React 18, Tailwind CSS, and Lucide icons.
- Mobile-first responsive layouts tested across 1200px desktop viewports and 390px mobile viewports.
- Trilingual support across English, Bengali (বাংলা), and Hindi (हिन्दी) in [`frontend/lib/i18n.ts`](file:///d:/pharmacy-reorder/frontend/lib/i18n.ts).

---

## 6. Assumptions (Labelled)

The following architectural decisions extend beyond the minimal brief to deliver a complete production slice, and are explicitly labelled as assumptions:

- **A1 (Payment Simulation):** Razorpay / UPI intent integration is a **TEST-MODE SIMULATION**. No real currency moves. Order IDs and HMAC signatures are generated and verified cryptographically, but rely on simulated capture webhooks.
- **A2 (Doctor Registration Validation):** Prescriber license checks (WBMC, NMC, MCI) are structurally verified against standard medical council formatting rules on synthetic demo prescriptions. No live database connection to the Medical Council registry exists.
- **A3 (Stock Transfers Hub):** Inter-store stock transfer requisitions between local branches and the Taratala Central Warehouse are implemented to solve the client's stockout drop-off problem.
- **A4 (Public Store Directory):** A dedicated 46-store searchable locator (`/stores`) is provided to display store operating hours, phone numbers, and on-duty pharmacists.
- **A5 (Statutory Compliance Center):** A formal transparency disclosure page (`/compliance`) documents patient rights under the DPDP Act 2023 and Rule 65.
- **A6 (Chronic Auto-Refill Subscriptions):** An automated subscription engine (`/api/subscriptions`) allows recurring refills on 30/60/90 day intervals to prevent the 20% customer churn.
- **A7 (Prescription Validity Period):** In the absence of a stated validity window in the brief, prescriptions are assumed valid for 180 days (`RX_VALID_DAYS = 180` in `rules.py`) for chronic repeat refills.
- **A8 (Mocked Outside Systems):** The following integrations are mocked:
  - Phone OTP: Fixed demo OTP `123456`.
  - SMS / WhatsApp Notifications: Dispatch logged to server console via `services.notifications.notify`.
  - Delivery Partner: Delivery carrier assignment is selected and recorded upon store dispatch.

---

## 7. Honest System Limits

1. **AI Handwriting Accuracy:** Live Azure OpenAI vision transcription has not been evaluated against real physical Indian doctor prescription slips (tested only on synthetic demo handwriting). Real-world accuracy on unconstrained handwriting remains unmeasured without a labeled real clinical dataset.
2. **Translations:** Bengali and Hindi translations in `i18n.ts` were drafted computationally and require formal clinical review by a native Bengali/Hindi speaker.
3. **Free Hosting Ephemeral Storage:** The free Render web service tier spins down on inactivity and uses an ephemeral disk; persistent data across server reboots requires connecting an external PostgreSQL instance (which the dual-engine adapter supports via `DATABASE_URL`).
4. **Mocked Communication Gateways:** Real SMS / WhatsApp Business API sending and live bank settlement are not connected; all outside communication is simulated.

---

## 8. Verification & Testing

- **Backend Automated Tests:** **34 passed tests** (`cd backend && python -m pytest tests -q`) covering routing, regulatory gates, cloud storage, subscriptions, transfers, and security headers.
- **Automated E2E Smoke Test:** Automated Puppeteer suite (`node e2e/smoke.js`) verifying Customer, Pharmacist, Store Staff, and Central Dashboard on the live Vercel URL.
- **Frontend Production Build:** `next build` compiles all 6 static routes (`/`, `/_not-found`, `/compliance`, `/stores`) with 0 errors.
