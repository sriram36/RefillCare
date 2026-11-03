# RefillCare: Product Requirements Document

Version 1.0 · 2 November 2026 · Author: Sriram Kolli · Status: core build complete, deployment pending

Repository: https://github.com/sriram36/RefillCare

This document describes the product for the pharmacy chain brief (Company A, Kolkata). It uses only the information in that brief. Anything else is labelled as an assumption (A1 to A10, section 17). Each requirement shows whether it is built.

## 1. Summary

RefillCare lets a pharmacy chain’s regular customers reorder their monthly medicines in about a minute and receive them the same day from the nearest store with stock. A registered pharmacist checks every prescription-only item before anything is packed, and the system physically blocks packing and dispatch until that approval exists.

An AI model reads uploaded prescriptions, but only as a draft. A human always decides.

## 2. Background and problem

Company A runs 46 stores across Kolkata and Howrah and a central warehouse, with 380 staff and revenue of ₹180–210 crore a year. A large share of sales is repeat medicine for diabetes, blood pressure and thyroid.

**Today:** customers call or WhatsApp a store with a photo of the prescription. Pharmacists check stock and reply, and staff deliver locally. Refills depend on the customer remembering. Prescriptions sit on store phones, and stores cannot see each other’s stock.

### Business case (the client’s own assumptions)

| Item | Working | Per year |
| --- | --- | --- |
| Missed refills | 9,000 regular customers × ₹2,200 a month; 20% (1,800) skip or buy elsewhere: 1,800 × ₹2,200 = ₹39.6 lakh of sales a month × 18% margin = ₹7.13 lakh a month | ₹85.54 lakh |
| WhatsApp order handling | 600 orders a day × 6 minutes = 60 hours a day × 360 days × ₹220 an hour | ₹47.52 lakh |
| **Total** |  | **₹1.33 crore** |

## 3. Goals and success metrics

The targets come from the brief. The last column says whether the product can measure them today.

| Goal | Target | Measured in product? |
| --- | --- | --- |
| Online adoption | 30% of regular customers ordering online within 6 months (about 2,700 of 9,000) | No. Needs analytics (phase 3). |
| Fewer lost refills | Monthly drop-off from 20% to 10% | No. Needs analytics; refill reminders exist. |
| Fast verification | Median pharmacist verification under 10 minutes | Yes. Shown on the dashboard. |
| Safety | No Schedule H or H1 item dispatched without approval | Yes. Enforced by the server and tested. Blocked attempts are logged. |

**Non-goals** (out of scope in the brief): doctor consultations, lab test booking, integration with store billing software. The product also never gives medical advice.

## 4. Users and roles

| Role | Needs | In the build |
| --- | --- | --- |
| Customer or caregiver (mobile) | Reorder in a minute; calm, trustworthy app; often ordering for a parent | Customer role |
| Store pharmacist | See the prescription beside the matched items; approve, edit or reject with a reason | Pharmacist role |
| Store staff | Pick, pack, enter the store invoice number, hand over to delivery | Store staff role, one account per store |
| Central operations | One view of orders across all 46 stores | The pharmacist dashboard (A3) |

## 5. Scope

**Core build required by the brief:** reorder flow with prescription upload, pharmacist verification queue, store routing, refill reminders. Roles: customer and pharmacist. AI: prescription reading as a draft. Hard part: blocking Schedule H items without approval.

**Built beyond the core:** store staff role, family profiles, search and over-the-counter cart, generic substitutes with consent, H1 register, central dashboard, daily stock CSV upload, store invoice number, UPI (test mode) and cash on delivery, delivery-area routing, in-app refill messages, English/Bengali/Hindi on the customer home.

**Not built:** see section 15.

## 6. Functional requirements

### 6.1 Customer

| ID | Requirement | Status |
| --- | --- | --- |
| C1 | Sign in with phone and OTP | Built; fixed demo OTP (A4) |
| C2 | Family profiles. Every order names who it is for, and the server rejects names not on the account | Built |
| C3 | Home screen: one large Reorder button, medicines running low with days left, no promotional content | Built |
| C4 | One-tap reorder of a refill; it goes to the pharmacist | Built |
| C5 | Upload a prescription photo (PNG or JPEG, up to 5 MB), choose who it is for, payment method and delivery area | Built |
| C6 | Search the catalog and add over-the-counter items to a cart. Prescription-only items say a prescription is needed; restricted items say they are not sold online | Built |
| C7 | Pay by cash on delivery or UPI (test mode only marks the order paid) | Built (mock) |
| C8 | Order tracking: status, store, payment, and notes such as a re-upload request | Built |
| C9 | Answer a generic suggestion: accept the cheaper generic or keep the original | Built |
| C10 | Refill reminder messages inside the app | Built (mock of the daily job) |
| C11 | English, Bengali and Hindi | Partial: customer home only |
| C12 | Reminders by SMS or WhatsApp | Not built |

### 6.2 Pharmacist

| ID | Requirement | Status |
| --- | --- | --- |
| P1 | Queue of all orders with status | Built |
| P2 | Side-by-side review: decrypted prescription image beside matched lines, each with its schedule and a confidence figure; below 75% is highlighted in amber | Built |
| P3 | Per line: approve (quantity can be edited, 1 to 50) or reject with a required reason | Built |
| P4 | Ask the customer for a clearer photo; the order goes on hold with a message | Built |
| P5 | Offer a cheaper generic on an approved line that has one on file | Built |
| P6 | H1 lines: approval requires prescriber and patient names, saved to the H1 register | Built |
| P7 | Dashboard: orders by store, median verification time, rejection reasons, H1 register, last 15 audit events | Built |
| P8 | Upload the daily stock CSV (store_id, med_id, qty); invalid files are rejected with a clear message | Built |
| P9 | Run the refill reminder job | Built (manual trigger) |

### 6.3 Store staff

| ID | Requirement | Status |
| --- | --- | --- |
| S1 | One account per store; sees only that store’s orders (awaiting, approved, packed, dispatched) | Built |
| S2 | Pack requires a store invoice number; then hand over to delivery | Built |
| S3 | Never sees prescriptions | Built |
| S4 | Cannot act on another store’s order | Built |
| S5 | A separate pick step | Not built; packing covers it (A5) |

### 6.4 Routing

| ID | Requirement | Status |
| --- | --- | --- |
| R1 | After approval, choose the nearest store holding every approved line, measured from the customer’s chosen delivery area (A2) | Built |
| R2 | If no store holds every line, keep the order approved with the note “No store has every item in stock” | Built |
| R3 | Re-route after the customer answers a generic offer | Built |
| R4 | Split an order across stores | Not built |

## 7. Business rules (the safety gate)

| Schedule | Added to cart | Prescription | Pharmacist approval | Extra |
| --- | --- | --- | --- | --- |
| OTC | Yes | Not needed | Not needed | None |
| H | Only through an uploaded prescription | Required | Required, per line | None |
| H1 | Only through an uploaded prescription | Required | Required, per line | Register entry (prescriber, patient, quantity) before packing |
| X and narcotic | Never. The line is refused when the order is created | n/a | n/a | Never sold online |
| Unknown | Treated as prescription-only | Required | Required | None |

**How it is enforced:** a single function, `can_dispatch`, runs on every pack and dispatch request on the server. It blocks the order if any line that is not rejected is prescription-only without an approving pharmacist, is H1 without a register entry, is restricted, or has a generic offer the customer has not answered. A block returns HTTP 403 with the code APPROVAL_REQUIRED and is written to the audit log. The cart endpoint applies the same rules, so calling the API directly cannot bypass them.

**Configurable rules:** the brief says online pharmacy rules are not final. The rules live in one table in `rules.py`, so a change is one edit. There is no admin screen for it yet (A6).

## 8. AI requirements

| Behaviour | Requirement |
| --- | --- |
| Role of the AI | Reads a prescription image and drafts lines (medicine text, quantity, confidence). It never approves, edits stock, or decides. |
| Matching | Each line is matched to the catalog by fuzzy matching. A line with no match is kept as “not in catalog” and can only be rejected. |
| Confidence | The shown confidence is the lower of the model’s figure and the match score. Below 75% is amber. |
| Unreadable image | The order goes on hold with a request for a clearer photo. |
| AI unavailable or not configured | Nothing is guessed. The order goes to the pharmacist with a note that they must read the image. |
| Generics | Suggested only by the pharmacist, and applied only if the customer consents. |
| Medical advice | The system gives none. |
| Accountability | Every upload, view, decision and blocked attempt is in the audit log. |

**Evaluation plan:** run the accuracy script on labelled images and report four numbers: lines read correctly, correct but flagged for review, wrong and confident (target zero), and unreadable images.

**Status:** the Azure OpenAI path is coded but has not been run against a real key. The demo prescriptions are synthetic. Accuracy on real handwriting has not been measured.

## 9. Order lifecycle

| From | To | Trigger |
| --- | --- | --- |
| (new upload or refill) | awaiting_pharmacist | Customer submits |
| (new upload) | on_hold | Image unreadable |
| awaiting_pharmacist | approved | Every line decided and at least one approved; store chosen |
| awaiting_pharmacist | rejected | Every line rejected |
| any | on_hold | Pharmacist asks for a new photo |
| (cart order) | approved | Over-the-counter items only, routed straight away |
| approved | packed | Store staff, gate passes, invoice number entered |
| packed | dispatched | Store staff hands over |

Known limitation: a re-upload request is answered by submitting a new upload. It is not linked to the held order.

## 10. Data model

| Table | Purpose |
| --- | --- |
| users | Customers, pharmacists and store staff, with role and store |
| profiles | Family members a customer orders for |
| meds | Catalog with schedule and price; generics point to the original |
| stores, stock | Stores with coordinates; quantity per medicine from the daily CSV |
| orders | Status, store, payment, delivery area, invoice number, note, verification time |
| items | Order lines with schedule, quantity, confidence, approver, rejection reason, generic offer and consent |
| refills | Medicine, quantity, daily dose, last filled |
| register | H1 entries: order, prescriber, patient, quantity |
| notes | In-app reminder messages |
| audit | Who did what, to which record, when |

## 11. Screens

| Screen | Role | Purpose |
| --- | --- | --- |
| Sign in | All | Phone and OTP, with demo account buttons |
| Home | Customer | Reorder, running low, search and cart, upload, messages, orders |
| Verification queue and review | Pharmacist | Queue on the left; prescription beside matched lines on the right |
| Dashboard | Pharmacist | Stores, verification time, rejections, H1 register, stock upload, reminders, activity |
| Store orders | Store staff | Pack with invoice number, hand over |

**Design principles from the brief:** calm and trustworthy, large text, a clear reorder button on the home screen, no promotional clutter, and the prescription and matched items side by side. The build uses a restrained teal palette, light and dark modes, visible focus outlines and tap targets of at least 44 pixels.

## 12. Non-functional requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Privacy (DPDP Act 2023) | Prescriptions are sensitive health data: encrypted at rest, and every view logged | Built |
| Access control | Role checks on every endpoint; store staff scoped to one store; prescription images pharmacist-only | Built |
| Sessions | Signed tokens that expire after 12 hours | Built (no revocation) |
| Input validation | File type and size, quantities, names, CSV format, payment and area values | Built |
| Secrets | None in the repository; environment variable names only | Built |
| Languages | Bengali, Hindi and English | Partial |
| Consent and retention | Consent capture, deletion and retention rules | Not built (see risks) |
| Scale | 46 stores, about 9,000 regular customers | Not load-tested; SQLite is single-writer |

## 13. Quality and test status

- 12 automated backend tests: the gate, routing, generic consent, H1 register, role scoping, validation, search and cart rules, reminders, and sample-order images.
- A UI smoke test runs the real front-end script in a simulated browser.
- A browser check at desktop and phone widths was run by a coding agent and reported by it. I have not independently confirmed it.
- Not tested: live AI reading, accuracy on real prescriptions, load.

## 14. Acceptance criteria

1. **Gate:** given an order with an unapproved Schedule H line, when store staff try to pack it, then the server returns 403 APPROVAL_REQUIRED and the attempt is logged.
2. **Restricted items:** given a prescription with a narcotic line, when the order is created, then that line is rejected with “Cannot be sold online”.
3. **Unreadable image:** given a blurry photo, when it is submitted, then the order is on hold with a request for a clearer photo.
4. **Side by side:** given an order awaiting review, when the pharmacist opens it, then the prescription image and matched lines show together.
5. **Generic consent:** given an offered generic, when the customer has not answered, then packing is blocked; after they answer it can proceed.
6. **Scope:** given a store staff account, when they list orders or request a prescription, then they see only their store’s orders and no prescription.
7. **Reorder:** given a medicine running low, when the customer presses Reorder, then an order awaits the pharmacist and still needs approval.

## 15. Not built and known gaps

- Real payment gateway and real SMS or WhatsApp sending.
- Customer street addresses and map pins; delivery areas are four sample areas.
- Bengali and Hindi beyond the customer home; the strings need a native speaker’s review.
- Accuracy measurement on real handwritten prescriptions; the live AI path is untested.
- DPDP consent capture, parental consent for minors, data retention and deletion.
- Prescription validity tracking: a refill reorder carries no prescription image, so the pharmacist relies on records outside the system.
- Splitting an order across stores; real stock feed instead of a CSV upload.
- Rate limiting on sign-in, token revocation, and a database that supports many writers.
- A separate central operations role; analytics for the adoption and drop-off targets.

## 16. Roadmap

| Phase | Focus | Contents |
| --- | --- | --- |
| 0: done | Core build | Everything marked Built above |
| 1: hardening | Safety and privacy | Postgres, real OTP provider, DPDP consent flows, token revocation, sign-in rate limits, prescription validity, measured AI accuracy on real prescriptions |
| 2: integrations | Real-world delivery | Payment gateway, SMS and WhatsApp, customer addresses and maps, live stock feed |
| 3: scale | 46 stores | Central operations role, adoption and drop-off analytics, split shipments, full translations with native review, H1 register export |

The brief gives ₹9 lakh and 8 weeks for the first phase. The current build is the core slice of that scope.

## 17. Assumptions

- **A1:** The catalog and Schedule classification are sample data. The two restricted items are fictional.
- **A2:** The brief gives no addresses, so the customer picks one of four sample delivery areas and distance is measured from sample coordinates.
- **A3:** The pharmacist dashboard stands in for central operations.
- **A4:** The OTP is a fixed demo code, UPI only marks an order paid, and messages and delivery are mocked.
- **A5:** Packing covers picking; there is no separate pick step.
- **A6:** Rules are configurable in one code table, with no admin screen.
- **A7:** A refill is due when five days or fewer of stock remain (quantity divided by daily dose).
- **A8:** Each branded medicine has at most one generic on file.
- **A9:** H1 register fields are prescriber, patient and quantity.
- **A10:** Prescription images in the demo are synthetic.

## 18. Risks and open questions

| Risk or question | Why it matters | Proposed action |
| --- | --- | --- |
| Real handwriting may read badly | The AI could look unreliable | Measure it first; keep it a draft; track the wrong-and-confident count |
| No consent capture or minors’ rules | The brief names DPDP obligations for sensitive health data | Phase 1 consent flows |
| Refill reorders have no prescription record in the system | A lapsed prescription could be approved | Ask the client how long a prescription stays valid; add expiry tracking |
| Rules may change | Online pharmacy rules are not final | Keep rules in one table; add an admin screen |
| No store has every item | The customer waits | Phase 3 split shipments |
| Free hosting resets data | A demo can lose orders | Use a persistent database for real use |

**Open questions for the client:** what format must the H1 register take, how long is a prescription valid for refills, and who owns delivery and its status updates?

