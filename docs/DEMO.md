# Demo guide

A seven-minute walk-through of RefillCare, followed by a map from each line of the brief to where it is built and tested, and an honest list of what is mocked.

## Before you start

- **Open the app** (live: https://refillcare.vercel.app). The backend runs on a free Render plan that sleeps when idle, so the **first request can take about 45 seconds**. Open the page a minute early and sign in once to wake it.
- On the sign-in screen press **Restart demo**. This puts back the sample orders, stock, reminders and the three demo customers' consent. It never deletes the access log.
- The OTP for every demo account is `123456`.
- Prefer to watch it run? `node e2e/demo_flow.js <app url>` performs everything below on its own, checks each step, and saves screenshots to `screenshots/demo/`.

## The walk-through

| # | Who | Do this | What to point out |
|---|---|---|---|
| 1 | Behala store | Sign in. Open `RX-50214`. | The order is **locked**: *Prescription medicines cannot be packed until a pharmacist approves them.* The button is disabled. Even a direct API call returns `403 APPROVAL_REQUIRED`. This is the hard part of the brief. |
| 2 | Debasish | Sign in. Agree to the data notice. | A calm home screen. The first thing on it is the medicine that is running low, for his mother, with the days left and one large **Reorder now** button. No offers, no clutter. |
| 3 | Debasish | Press **Reorder now**. | One tap. The button is replaced by *Order RX-50220 is already in progress*, so a second tap cannot create a duplicate. His mother's prescription on file is reused, but the pharmacist still checks it. |
| 4 | Rina | Sign in, agree. Her Telmisartan is also due, but `RX-50214` is already open, so there is no reorder button. Press **Send a prescription**, open *No prescription handy?*, pick **Not sold online**, press **Send for pharmacist check**. | She chooses who it is for (family profiles), the area and how to pay. The sample has a Schedule X medicine and paracetamol. |
| 5 | Arif | Sign in, agree. | His prescription was unreadable, so he sees one plain sentence and a button. Open *No prescription handy?* and pick **Printed** to send a clearer photo. |
| 6 | Anita (pharmacist) | Sign in. Open `RX-50214`. | The queue shows what is waiting and for how long. The **prescription is on the left and what the AI read is on the right**, so she compares them. The AI output is a draft: she approves, edits the quantity, or rejects with a reason. |
| 7 | Anita | Press **Approve**, then **Offer to customer**. | The cheaper generic is only an offer. It is never swapped without the customer's consent. |
| 8 | Anita | Open Rina's new order. | The Schedule X line was **rejected on sight** (*Cannot be sold online*) and cannot even be approved. Approve the paracetamol. |
| 9 | Rina | Reload. Press **Accept** on the generic. | *You saved ₹285.* She was asked, in plain words, before anything changed. |
| 10 | Behala store | Reload. **Pack and enter invoice**, type an invoice number, then **Hand over to delivery**. | Packing only became possible after approval. Stock is taken from the store's count at the moment it is packed. |
| 11 | Rina | Reload. | *On the way with Store delivery staff.* A four-step progress line, no horizontal scrolling on a phone. |
| 12 | Anita | Open the **All stores** tab. | Median verification time (a real figure from the orders, under the 10-minute target), orders by store, **rejections with reasons**, low stock, the H1 register, and **Sent without approval: 0**, which is measured from the data and not a fixed label. |
| 13 | Anita, then Debasish | **Send today's reminders**. Then sign in as Debasish. | The reminder is under *Messages*, with a one-tap reorder right below it. It is sent in the customer's own language. |
| 14 | Anyone | Change the language (top right) to বাংলা, then हिन्दी. | Every customer screen is translated, not just the headings. |
| 15 | A new customer | Sign out. Enter any new 10-digit number, the OTP, and a name. Agree to the data notice, then scroll to the bottom and press **Delete my data**. | Anyone can register. Their data can be downloaded or deleted from the home screen. Records the law requires, such as the H1 register, are kept. |

## Where each requirement lives

| Brief | Where | Checked by |
|---|---|---|
| OTP login, family profiles, search, upload, cart, UPI and cash on delivery (test mode), tracking | Customer screen: `frontend/components/CustomerView.tsx` and `customer/` | `e2e/demo_flow.js` |
| Refill subscriptions | *Refill automatically every month* on a refill card. `backend/routers/subscriptions.py` | `test_safety_gate.py::test_subscription_order_is_blocked_until_approved_and_counts_packs` |
| Pharmacist queue: prescription beside the matched items, approve, edit, reject with reason | `frontend/components/PharmacistView.tsx`, `backend/routers/pharmacist.py` | `e2e/demo_flow.js` |
| **No Schedule H or H1 item dispatched without approval** | `backend/rules.py::can_dispatch`, enforced on every pack and dispatch in `routers/store.py` | `test_safety_gate.py` (every order path), measured on the dashboard |
| Schedule X and narcotics never sold online | Refused at the cart, rejected on sight from a prescription, and cannot be approved | `test_schedule_x_and_narcotics_cannot_be_approved_or_sold`, `test_cart_never_sells_prescription_or_blocked_items` |
| H1 sale needs prescriber and patient in a register | H1 approval form. `register` table. No second row if approved twice | `test_full_path_works_only_after_approval_and_h1_needs_register` |
| Routing to the nearest store with stock, from a daily stock CSV | `backend/services/routing.py`. Upload on the dashboard (`store_id,med_id,qty`) | `test_order_routes_to_a_store_that_has_stock`, `test_no_single_store_gives_a_clear_reason` |
| Refill reminders from quantity and dosage, one-tap reorder | `rules.days_left`, `routers/dashboard.py::run_reminders`, *Messages* on the home screen | `test_pack_and_days_maths`, `test_reminders_go_out_in_the_customers_language_once_a_day` |
| Store screen: pick, pack, invoice number, handover | `frontend/components/StoreView.tsx` | `e2e/demo_flow.js` |
| Central dashboard: orders by store, verification time, rejections | `frontend/components/DashboardView.tsx` | `e2e/demo_flow.js`, `test_dashboard_counts_approval_breaches_and_reports_real_verification_time` |
| AI reads the prescription as a draft only; unreadable gets a re-upload request; generics need approval and consent | `backend/services/ocr.py`, `routers/orders.py`. The AI only creates *draft* lines | `e2e/demo_flow.js`, `test_generic_needs_consent_and_cannot_change_a_packed_order` |
| Rules configurable, since online-pharmacy rules are not final | `backend/data/rules.json`: which schedules need a prescription, which are blocked, how long a prescription is valid | `test_rules_file_is_loaded_and_a_bad_file_stops_startup` |
| Prescriptions encrypted and access logged (DPDP) | Encrypted at rest (`core/crypto.py`). Every opening is written to the access log, which the demo reset never deletes | `tests/test_security_dpdp.py`, `test_demo_reset_is_switchable_and_keeps_the_audit_log` |
| Bengali, Hindi, English | `frontend/lib/i18n.ts`. All customer screens, plus reminder messages | `e2e/demo_flow.js`, and `npm run check:i18n` in `frontend/` (every key exists in all three languages) |
| Calm, minimal, large text, a clear reorder button | 17px base text, one primary action per screen, teal on white, no promotional content | Screenshots in `screenshots/demo/`; no screen scrolls sideways at 390px |

## What is mocked, and what is not finished

Said plainly, so nobody finds it later:

- **Sign-in** uses a fixed demo OTP (`123456`). There is no SMS.
- **Payments** are in test mode. The server confirms a test payment for the signed-in customer. The real payment callback exists and checks its signature, but stays closed until a gateway secret is configured.
- **Messages** (WhatsApp and SMS) are recorded and shown in the app, not actually sent.
- **AI reading** of prescriptions is real only when an Azure OpenAI key is configured. Without one, the sample prescriptions return fixed reads, and an uploaded photo goes to the pharmacist to read by hand.
- **Stores**: three are seeded (Salt Lake, Behala, Howrah Maidan), not 46. The stock CSV route handles any number of stores.
- **Staff screens** (pharmacist, store, dashboard) and the privacy page are in English only. The customer screens, which the brief centres on, are in all three languages.
- **Reminders** run when a pharmacist presses the button. They are not on a timer yet.
- **Routing** picks one store that has every item. If none does, the pharmacist sees which medicine is short, and stores can request a transfer from each other.
- **PostgreSQL** is not finished. The deployment uses SQLite, which on a free Render plan resets when the service restarts.
