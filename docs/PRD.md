# RefillCare: Product Requirements Document

- **Version:** 2.0 (Production Hardened) · Author: Sriram Kolli · Status: Complete & Verified
- **GitHub Repository:** [https://github.com/sriram36/RefillCare](https://github.com/sriram36/RefillCare)
- **Live App (Vercel):** [https://refillcare.vercel.app](https://refillcare.vercel.app)
- **Backend API (Render):** [https://refillcare.onrender.com](https://refillcare.onrender.com)

This document describes the product for the pharmacy chain brief (Company A, Kolkata). It uses only the information in that brief. Anything else is labelled as an assumption (A1 to A14, section 17). Each requirement shows whether it is built.

---

## 1. Summary

RefillCare lets a pharmacy chain’s regular customers reorder their monthly medicines in about a minute and receive them the same day from the nearest store with stock. A registered pharmacist checks every prescription-only item before anything is packed, and the system physically blocks packing and dispatch until that approval exists.

An AI model reads uploaded prescriptions, but only as a draft. A human registered pharmacist always decides.

---

## 2. Background and Problem

Company A runs a pharmacy network across Kolkata and Howrah (the client's chain has 46 stores; this demo seeds the three stores named in the brief: Salt Lake, Behala, Howrah Maidan) and a central warehouse, with 380 staff and revenue of ₹180–210 crore a year. A large share of sales is repeat medicine for diabetes, blood pressure and thyroid.

**Today:** customers call or WhatsApp a store with a photo of the prescription. Pharmacists check stock and reply, and staff deliver locally. Refills depend on the customer remembering. Prescriptions sit on store phones, and stores cannot see each other’s stock.

### Business Case (The Client's Own Projections)

| Item | Working | Per year |
| --- | --- | --- |
| Missed refills | 9,000 regular customers × ₹2,200 a month; 20% (1,800) skip or buy elsewhere: 1,800 × ₹2,200 = ₹39.6 lakh of sales a month × 18% margin = ₹7.13 lakh a month | ₹85.54 lakh |
| WhatsApp order handling | 600 orders a day × 6 minutes = 60 hours a day × 360 days × ₹220 an hour | ₹47.52 lakh |
| **Total** | | **₹1.33 crore** |

---

## 3. Goals and Success Metrics

| Goal | Target | Measured in product? |
| --- | --- | --- |
| Online adoption | 30% of regular customers ordering online within 6 months (~2,700 of 9,000) | No. Needs long-term analytics. |
| Fewer lost refills | Monthly drop-off from 20% to 10% | Yes. Refill reminders & auto-refills built. |
| Fast verification | Median pharmacist verification under 10 minutes | Yes. Measured and shown on the central dashboard. |
| Safety | No Schedule H or H1 item dispatched without approval | Yes. Hard regulatory gate enforced by server. Blocked attempts logged. |

**Non-goals** (out of scope in the brief): doctor consultations, lab test booking, integration with store billing software. The product never gives medical advice.

---

## 4. Users and Roles

| Role | Needs | In the build |
| --- | --- | --- |
| Customer or caregiver (mobile) | Reorder in a minute; calm, trustworthy app; often ordering for a parent | Customer role |
| Store pharmacist | See the prescription beside the matched items; approve, edit or reject with a reason | Pharmacist role |
| Store staff | Pick, pack, enter the store invoice number, hand over to delivery | Store staff role (scoped per store) |
| Central operations | One view of orders across stores (the client's chain has 46 stores; this demo seeds the three stores named in the brief) | All stores tab in the pharmacist view |

---

## 5. Scope

**Core build required by the brief:** reorder flow with prescription upload, pharmacist verification queue, store routing, refill reminders. Roles: customer and pharmacist. AI: prescription reading as a draft. Hard part: blocking Schedule H items without approval.

**Built and hardened:** store staff role, family profiles, search and over-the-counter cart, generic substitutes with consent, statutory H1 register, central dashboard, daily stock CSV upload, store invoice number, UPI payment (test mode simulation), cash on delivery, delivery-area routing, in-app refill messages, trilingual support (English, Bengali, Hindi), DPDP Act consent and Right to Erasure, token revocation, chronic auto-refill subscriptions, and store stock transfers.

---

## 6. Functional Requirements

### 6.1 Customer

| ID | Requirement | Status |
| --- | --- | --- |
| C1 | Sign in with phone and OTP | Built; fixed demo OTP `123456` |
| C2 | Family profiles (Every order names who it is for; server rejects invalid profiles) | Built |
| C3 | Home screen: one large Reorder button, medicines running low with days left, no promotional clutter | Built |
| C4 | One-tap reorder of a refill; it goes to the pharmacist queue | Built |
| C5 | Upload a prescription photo (PNG or JPEG, up to 5 MB), choose who it is for, payment method and delivery area | Built |
| C6 | Search the catalog and add OTC items to a cart. Prescription items require an Rx; restricted items cannot be added | Built |
| C7 | Pay by cash on delivery or UPI (test mode simulation) | Built (test mode) |
| C8 | Order tracking: 5-stage timeline, store, payment, and notes | Built |
| C9 | Answer a generic suggestion: accept the cheaper generic or keep the original | Built |
| C10 | Refill reminder messages inside the app and automated cron trigger | Built |
| C11 | English, Bengali and Hindi across customer touchpoints | Built (needs native speaker clinical review) |
| C12 | Reminders by SMS or WhatsApp | Mocked (log lines via `services.notifications.notify`) |

### 6.2 Pharmacist

| ID | Requirement | Status |
| --- | --- | --- |
| P1 | Queue of all orders with status | Built |
| P2 | Side-by-side review: decrypted prescription image beside matched lines, each with its schedule and a confidence figure; below 75% highlighted in amber | Built |
| P3 | Per line: approve (quantity editable, 1 to 50) or reject with a required reason | Built |
| P4 | Ask the customer for a clearer photo; order placed on hold | Built |
| P5 | Offer a cheaper generic on an approved line that has one on file | Built |
| P6 | H1 lines: approval requires prescriber license and patient names, saved to the H1 register | Built |
| P7 | Dashboard: orders by store, median verification time, rejection reasons, H1 register, last 15 audit events | Built |
| P8 | Upload the daily stock CSV (store_id, med_id, qty); invalid files rejected with clear messages | Built |
| P9 | Run the refill reminder job | Built |

### 6.3 Store Staff

| ID | Requirement | Status |
| --- | --- | --- |
| S1 | One account per store; sees only that store’s orders (awaiting, approved, packed, dispatched) | Built |
| S2 | Pack requires a store invoice number; then hand over to delivery | Built |
| S3 | Never sees prescriptions | Built |
| S4 | Cannot act on another store’s order | Built |
| S5 | Requisition stock from Central Warehouse / other stores | Built |

### 6.4 Routing

| ID | Requirement | Status |
| --- | --- | --- |
| R1 | After approval, choose the nearest store holding every approved line from customer zone | Built |
| R2 | If no store holds every line, keep order approved with note “No store has every item in stock” | Built |
| R3 | Re-route after customer answers a generic offer | Built |
| R4 | Split an order across stores | Not built (client constraint: full-order routing) |

---

## 7. Business Rules (The Safety Gate)

| Schedule | Added to cart | Prescription | Pharmacist approval | Extra |
| --- | --- | --- | --- | --- |
| OTC | Yes | Not needed | Not needed | None |
| H | Only via uploaded prescription | Required | Required, per line | None |
| H1 | Only via uploaded prescription | Required | Required, per line | Register entry (prescriber, patient, quantity) before packing |
| X and narcotic | Never. The line is refused when order is created | n/a | n/a | Never sold online |
| Unknown | Treated as prescription-only | Required | Required | None |

**Enforcement:** `rules.can_dispatch()` runs on every pack and dispatch request. Any unapproved prescription line blocks with HTTP 403 `APPROVAL_REQUIRED`.

---

## 8. AI Requirements

| Behaviour | Requirement |
| --- | --- |
| Role of the AI | Reads prescription image and drafts lines (medicine text, quantity, confidence). Never approves or dispenses. |
| Matching | Each line is matched to the catalog by fuzzy matching. Unmatched lines are kept as “not in catalog”. |
| Confidence | Confidence is the lower of model score and match ratio. Below 75% is amber. |
| Unreadable image | Order placed on hold with re-upload notification. |
| AI unavailable | Order goes to pharmacist queue for manual visual verification. |
| Generics | Suggested by pharmacist; applied only upon affirmative customer consent. |
| Medical advice | The system gives none. |
| Accountability | Every upload, view, decision, and blocked attempt is written to the audit log. |

---

## 9. Order Lifecycle

| From | To | Trigger |
| --- | --- | --- |
| (new upload or refill) | `awaiting_pharmacist` | Customer submits |
| (new upload) | `on_hold` | Image unreadable |
| `awaiting_pharmacist` | `approved` | Every line decided, at least one approved; store chosen |
| `awaiting_pharmacist` | `rejected` | Every line rejected |
| any | `on_hold` | Pharmacist asks for new photo |
| (cart order) | `approved` | Over-the-counter items only, routed immediately |
| `approved` | `packed` | Store staff, gate passes, physical invoice number entered |
| `packed` | `dispatched` | Store staff hands over to delivery partner |

**Re-upload capability:** Customers re-upload directly to their existing `on_hold` order via `POST /api/orders/{code}/reupload`.

---

## 10. Non-Functional Requirements & Security

| Area | Requirement | Status |
| --- | --- | --- |
| Privacy (DPDP Act 2023) | Prescriptions encrypted at rest with Fernet (AES-128-CBC with HMAC-SHA256); every view logged | Built |
| Access control | Role checks on every endpoint; store staff scoped to one store | Built |
| Sessions | Signed tokens with server-side revocation on logout (`token_ver`) | Built |
| Consent & Erasure | DPDP consent capture upon login; Section 12 Right to Erasure (`/api/me/forget`) | Built |
| Rate limiting | In-memory 5 attempts / 10 min rate limiting on login | Built |
| Security headers | OWASP headers (`nosniff`, `DENY`, `strict-origin`) injected | Built |
| Scale | SQLite. A PostgreSQL adapter exists but is unfinished (tables are only created for SQLite) | Partly built |

---

## 11. Quality and Test Status

- **80 automated backend tests** (`python -m pytest backend/tests -q`): the approval gate on every order path, Schedule X, routing and stock, generic consent, H1 register, role scoping and ownership, search/cart, reminders, signed payments, storage, subscriptions, transfers, the rules file, and security.
- **End-to-end demo flow** (`node e2e/demo_flow.js <url>`): the whole story through the real screens as each person, 32 checks, including a 390px phone check that no screen scrolls sideways.
- **Translation check** (`npm run check:i18n` in `frontend/`).

---

## 12. Not Built and Real Open Limits

- Real banking payment gateway (payment is a dummy screen for the UI only; no real currency moves).
- Real SMS / WhatsApp Business API sending (mocked in-app & log lines only).
- Live Azure reading not measured on real handwriting (tested on synthetic demo prescriptions only; real clinical accuracy not benchmarked without physical doctor slips).
- Bengali and Hindi translations in `i18n.ts` need review by a native clinical speaker.
- Free Render instance resets SQLite database data on sleep/restart (persistent storage needs a paid disk, or finishing the PostgreSQL support).

---

## 13. Assumptions (Labelled)

- **A1:** Catalog and Schedule classifications are sample data.
- **A2:** Customer delivery areas are four sample Kolkata/Howrah zones.
- **A3:** Payment is a **dummy**, for the screen only (no gateway, no real money).
- **A4:** Doctor registration number: format check only; informational; does not block dispensing. Structural check runs on synthetic demo prescriptions only.
- **A5:** Inter-store stock transfers from the central warehouse are implemented to solve stockouts.
- **A6:** A statutory compliance center (`/compliance`) is provided.
- **A7:** Chronic auto-refill subscriptions engine (`/api/subscriptions`) runs on 30/60/90 day intervals.
- **A8:** Prescriptions are assumed valid for 180 days (`RX_VALID_DAYS = 180` in `rules.py`) for chronic refills.
- **A9:** OTP authentication uses fixed demo code `123456`.
- **A10:** SMS/WhatsApp notifications are logged to server console via `services.notifications.notify`.
- **A11:** Packing covers picking; invoice number entry is mandatory before packing.
- **A12:** Each branded medicine has at most one generic alternative on file.
- **A13:** Prescription images in the demo seed data are synthetic.
- **A14:** Store staff operate in English; patient interfaces are trilingual.
