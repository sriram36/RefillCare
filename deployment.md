# Deployment

## Run locally
1. `python -m venv .venv && source .venv/bin/activate`
2. `pip install -r requirements.txt`
3. `uvicorn app:app --reload`  (the SQLite database and sample data are created on first start)
4. Open http://localhost:8000
5. Tests: `python -m pytest -q`

## Deploy
Any host that runs a Python web service (Render, Railway, Fly). Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`. Use a persistent disk for `pharmacy.db` and `rx_store/`.

## Environment variables (names only)
`APP_SECRET`, `RX_ENC_KEY` (Fernet key), `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `DB_PATH` (optional).
Without the Azure variables the app uses the four built-in demo prescriptions; any other upload goes to the pharmacist for manual reading.

## Demo logins (OTP for all: 123456)
| Role | Phone |
|---|---|
| Customer (Debasish) | 9000000001 |
| Customer (Rina) | 9000000002 |
| Pharmacist | 9000000099 |

## Three-minute tour
1. Sign in as Debasish. "Running low" shows Metformin with about 4 days left. Press Reorder.
2. Upload a demo prescription ("clear printed").
3. Sign in as the pharmacist. Open the new order. The prescription image is beside the matched lines.
4. Press Pack before approving. It is blocked with the reason.
5. Approve both lines (the order is routed to the nearest store with stock), then Pack and Hand to delivery.
6. As the customer, upload "blurry" (asks for a new photo) and "restricted item" (the restricted line is refused).

## More to try
7. Upload "controlled (H1)". Approving it asks for prescriber and patient name; the entry appears under Dashboard, H1 register.
8. Approve a Metformin line, press "Offer cheaper generic", then sign in as the customer and accept it. Pack is blocked until they answer.
9. Dashboard shows orders by store, median verification time and rejections. Upload `data/stock.csv` to refresh stock.
10. Switch the language (top right) to Bengali or Hindi on the customer home.
11. Press "Add a person" on the customer home, then upload a prescription for them. Pick UPI (test mode) or cash on delivery, and a delivery area.
12. As the pharmacist, Dashboard, "Send today's reminders". The customer sees the message on their home screen.

## Docker
`docker build -t pharmacy-reorder . && docker run -p 8000:8000 -e APP_SECRET=change-me pharmacy-reorder`

## Accuracy check (needs your Azure key)
Put labelled images in a folder, copy `eval/labels.example.json`, then `python eval/run_eval.py <folder> <labels.json>`.

## UI smoke test
With the app running: `npm i jsdom && BASE=http://localhost:8000/ node tests/ui_smoke.js`

## Publish
`git remote add origin https://github.com/sriram36/<repo>.git && git push -u origin main` (keep the repo public until review ends).
