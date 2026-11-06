# RefillCare Frontend (Next.js 14 + Tailwind CSS)

Dedicated modern web application for RefillCare pharmacy reorder and verification platform.

## Architecture
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Custom Healthcare Theme Tokens
- **Icons:** Lucide React
- **API Client:** Clean fetch wrapper with token authentication and DPDP Act compliance handling

## Roles & Screens
Design rules: 17px base text, one primary action per screen, teal on white, large touch targets, nothing promotional, no sideways scrolling at 390px. Customer-facing text goes through `lib/i18n.ts` in English, Bengali and Hindi, and `npm run check:i18n` keeps the three in step.

1. **Customer (`CustomerView.tsx`, `components/customer/`):**
   - Home leads with whatever is running low (5 days or fewer) and one large **Reorder now** button; it becomes "already in progress" once an order is open
   - Reminder messages, "Send a prescription" (who it is for, area, payment, photo) and "Find a medicine" (over-the-counter cart) open on demand
   - Orders as one plain sentence plus a 4-step progress line, UPI test payment, re-upload when a photo is sent back
   - Generic offer with explicit Accept / Keep original
   - Auto-refill from a refill card, family profiles (a parent or guardian must consent for under 18), download or delete my data
2. **Pharmacist (`PharmacistView.tsx`):**
   - Queue sorted with what needs checking first and how long it has waited
   - The prescription image beside the matched items (AI draft), zoom, approve with quantity, reject with a reason, ask for a new photo
   - Add a medicine from the catalogue when the AI missed or misread one (it still needs approval)
   - Schedule H1 register form; offer a cheaper generic (customer must agree)
   - Who opened the prescription (access log)
3. **Store (`StoreView.tsx`):**
   - Orders for this store only, locked until a pharmacist approves
   - Pack with the invoice number from the billing software, hand over to delivery
   - Stock transfers between stores
4. **All stores (`DashboardView.tsx`):**
   - Median verification time against the 10-minute target, orders by store, rejections with reasons, low stock, the H1 register
   - Measured count of items sent without approval (must be 0)
   - Daily stock CSV upload, send reminders, recent activity

## Quick Start (Local Development)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

To connect to a remote backend (e.g. Render), create `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://refillcare.onrender.com
```

## Production Build

```bash
npm run build
npm run start
```

## Deployment (Vercel / Render Static Site)
- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Environment Variable:** `NEXT_PUBLIC_API_URL=https://refillcare.onrender.com`
