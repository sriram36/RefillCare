# RefillCare: Technical Design Document

Version 1.0 · 2 November 2026 · Author: Sriram Kolli  
GitHub: https://github.com/sriram36/RefillCare.git  ·  Live app: <add URL if deployed>

## 1. Architecture and why
FastAPI + SQLite, single service, plain HTML/JS frontend without build frameworks. Chosen so the entire core slice runs with one command (`uvicorn app:app`) and a reviewer can evaluate it immediately with zero complex toolchains. Pure business rules live in `rules.py` (no DB dependencies, cleanly isolated, and 100% unit-tested). Moving to Postgres and Next.js represents the next scaling step, not a architectural rethink.

## 2. Data model
- `users`: id, name, phone (unique), role, store_id, consent_at, token_ver (defaults to 1).
- `meds`: id, name, schedule, price, generic_of.
- `stores`: id, name, lat, lng.
- `stock`: store_id, med_id, qty (primary key: store_id, med_id; populated from daily CSV).
- `orders`: code (primary key), customer_id, for_name, status, store_id, rx_file, note, created, verified_at, invoice_no, payment (cod/upi_test), paid (0/1), area.
- `items`: id, order_code, med_id, name, schedule, qty, price, conf, status (draft/approved/rejected), approved_by, reason, offer, consent.
- `prescriptions`: id, customer_id, profile_name, order_code, rx_file, approved_at, valid_until (tracks 180-day chronic refill validity).
- `refills`: id, customer_id, for_name, med_id, qty, per_day, last_filled.
- `audit`: ts, actor, action, entity (logs every upload, view, pharmacist decision, and blocked attempt).
- `profiles`: id, customer_id, name, relation, is_minor (0/1), guardian_consent (0/1).
- `notes`: customer_id, text, ts, day.
- `register`: order_code, item_id, prescriber, patient, qty, ts (statutory Drugs and Cosmetics Act H1 register).

## 3. Main flows & Safety Gates
**Roles:**
- `customer`: reorders chronic refills, searches OTC products, uploads prescriptions, manages family profiles, grants DPDP consent, exports personal data.
- `pharmacist`: reviews side-by-side prescriptions, approves/rejects line items with reason, offers generic substitutes, views cross-store dashboard and H1 register.
- `store`: scoped strictly to assigned store location, packs approved orders, enters store invoice number, hands off to delivery. Store staff never see prescription photos.

**The Safety Dispatch Gate:**
- `can_dispatch()` in `rules.py` runs server-side on every pack and dispatch attempt.
- Any prescription-only line (Schedule H, H1) that lacks registered pharmacist approval blocks the order with HTTP 403 `APPROVAL_REQUIRED`.
- Controlled items (Schedule X, narcotics) are refused immediately during prescription reading/drafting. Unknown schedules default strictly to prescription-only.
- If a generic substitution has been offered, packing and dispatch remain physically blocked until the customer accepts or keeps the original.

**Prescription Records & Refill Continuity (Step 2):**
- When a pharmacist approves an Rx line with an uploaded prescription image, a record is recorded or refreshed in `prescriptions` with `valid_until = today + 180 days`.
- On chronic refill reorders: if an active prescription record exists, its encrypted image is attached to the new order with note `"Prescription on file, valid until <date>"`.
- If no record exists or if the prescription is expired (>180 days), the refill order is automatically placed `on_hold` with note `"Please upload a current prescription"`.
- Pharmacist approval of an Rx item is physically blocked (HTTP 422) if an order has neither an uploaded photo nor a valid prescription record on file.

**Re-upload Linked to Held Orders (Step 1):**
- Customers can upload a new prescription photo directly to their existing `on_hold` order via `POST /api/orders/{code}/reupload`. The old draft items are purged, extraction re-runs, and the order advances to `awaiting_pharmacist`.

**Consent & Minors under DPDP Act (Step 3):**
- Plain-language consent screen displayed upon first sign-in outlining what data is collected, why, and who accesses it.
- Health order placements and prescription uploads are blocked with HTTP 403 `CONSENT_REQUIRED` until consent is recorded via `POST /api/consent`.
- Family profiles for minors (under 18) require explicit guardian consent (`guardian_consent = 1`), and orders for minor profiles without verified guardian consent are rejected (HTTP 422).
- Customers can export their complete profile, order, and prescription history as JSON via `GET /api/me/export`.

**Sign-In Hardening & Session Revocation (Step 4):**
- In-memory rate limiting: 5 failed OTP attempts for a phone number within 10 minutes returns HTTP 429 lockout.
- Real token revocation: tokens carry the user's `token_ver` (`{uid}.{token_ver}.{exp}.{sig}`). Invoking `POST /api/logout` increments `token_ver` in SQLite, instantly invalidating all existing tokens for that account.

**Operations & Customer Tracking Extensions:**
- Order progress timeline: Customer order cards display a 5-step visual tracking timeline (`Placed` → `Verification` → `Approved` → `Packed` → `Out for delivery`) with status-responsive indicator dots.
- Mock UPI verification: When `upi_test` is selected, an explicit UTR reference (`payment_ref`) is recorded and surfaced across customer and store receipts.
- Store handover tracking: Store staff record the designated delivery partner / executive upon dispatch (`delivery_partner`), visible to customers upon dispatch.
- DPDP prescription audit access: Pharmacists can view order-specific audit logs (`GET /api/orders/{code}/audit`) detailing who uploaded, reviewed, and accessed prescription records.
- 46-Store regional operations overview: Central dashboard provides an operational breakdown across all stores (awaiting, approved, packed, dispatched) alongside low-stock alerts (≤ 5 units).
- Generic savings summary: Customer order view automatically calculates and highlights total rupee savings when generic substitutions are accepted.
- Refill notification dispatch: `run_reminders()` triggers customer phone notifications via the `notify()` stub, providing immediate operational feedback.

## 4. AI Vision Prescription Reading
A vision model reads uploaded prescription photos, outputting legible status, matched medicine lines, estimated quantities, and confidence scores (0.0 to 1.0).
- **Draft only:** Model output is strictly advisory. Every detected line is fuzzy-matched against the approved catalog. Uncataloged lines or low confidence (<0.75) are visually flagged in amber.
- **Fail-safe:** If the image is blurred or illegible, the order is placed on hold for re-upload. If AI extraction is offline or unconfigured, nothing is guessed: the order enters the pharmacist queue for manual visual verification.
- **Security:** Uploaded prescription images are encrypted on disk with Fernet encryption (`rx_store/*.enc`) and every view by a pharmacist is logged in the audit trail. Store staff cannot access prescription images.

## 5. UI & Responsive Design
- Clean visual hierarchy with high contrast, accessible touch targets (≥44px min-height), and smooth card layouts.
- Full responsive support down to 390px mobile viewports (zero horizontal overflow across all screens).
- English, Bengali, and Hindi language support across all customer-facing surfaces (home, refill reminders, search, cart, prescription upload, order status badges, generic consent, and DPDP notices).

## 6. Assumptions (Labelled)
- **A1:** Schedule list and medicine catalog are sample data; "Demo Restricted-X" and "Demo Narcotic" represent restricted control items.
- **A2:** Customer delivery areas are selected from four sample Kolkata/Howrah zones (Park Street, Salt Lake, Behala, Howrah); routing calculates nearest store with stock via Haversine formula from zone coordinates.
- **A3:** OTP authentication is configured with fixed demo code `123456`; UPI is operating in demo/test mode.
- **A4:** Initial demo prescriptions and seeded orders use synthetic demo images.
- **A5:** Refills are marked "running low" when estimated supply is 5 days or fewer (`qty // per_day`).
- **A6:** User sessions last 12 hours unless revoked via `POST /api/logout`.
- **A7:** Each branded medicine has at most one generic substitute on file; H1 register fields follow statutory Drugs and Cosmetics Act requirements (order code, item, prescriber, patient, quantity, timestamp).
- **A8:** Prescription validity period is assumed to be 180 days (`RX_VALID_DAYS = 180` in `rules.py`) for chronic refills (the brief specifies no statutory validity period).
- **A9:** Multilingual support (Bengali and Hindi) is provided for all customer-facing interfaces; pharmacist and store-staff operational screens remain in English (assumption: operational personnel operate in English). Bengali and Hindi text needs a native speaker's review.
- **A10:** Sign-in rate limiting (5 failed attempts per phone in 10 minutes returns HTTP 429) is tracked in-memory for the single-instance service.

## 7. Current Scope & Limits
- **Built & Verified:**
  - Strict dispatch safety gate (`can_dispatch`).
  - Pharmacist review queue with side-by-side encrypted prescription display.
  - Store staff role with store-scoped orders and mandatory invoice logging.
  - Generic drug substitution with required customer consent.
  - Statutory Schedule H1 digital register.
  - Central operational dashboard (median verification time, store breakdown, rejections, audit log).
  - Daily stock CSV upload with instant inventory updates.
  - Re-upload capability for held orders (`POST /api/orders/{code}/reupload`).
  - Prescription validity tracking and refill image attachment (180-day chronic rule).
  - DPDP Act customer consent flow, minor guardian consent enforcement, and data export (`GET /api/me/export`).
  - In-memory rate limiting and server-side token revocation on logout.
  - Customer interface in English, Bengali, and Hindi with responsive 390px layout.
  - 20 automated backend tests (`python -m pytest -q`) and full simulated DOM UI smoke test (`node tests/ui_smoke.js`).
- **Not Built (Out of Brief Scope):**
  - Doctor teleconsultations and diagnostic lab test booking.
  - Live bank payment gateway integration (UPI test mode provided).
  - Direct SMS gateway / WhatsApp Business API sending (mocked in-app).
  - Automated DPDP data erasure / retention policy enforcement lifecycle.
