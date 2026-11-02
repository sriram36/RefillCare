# RefillCare Frontend (Next.js 14 + Tailwind CSS)

Dedicated modern web application for RefillCare pharmacy reorder and verification platform.

## Architecture
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Custom Healthcare Theme Tokens
- **Icons:** Lucide React
- **API Client:** Clean fetch wrapper with token authentication and DPDP Act compliance handling

## Roles & Screens
1. **Customer Web App (`CustomerView.tsx`):**
   - 1-Tap monthly medicine reorder hero button
   - "Running Low" active alerts for chronic prescriptions (Metformin, Telmisartan, Levothyroxine)
   - Real-time medicine search with live stock check across 46 stores
   - Prescription upload with AI reading draft indicator
   - 5-stage live order tracking timeline
   - Generic substitution consent & savings prompt
   - DPDP Act family profiles and data download
2. **Pharmacist Verification Queue (`PharmacistView.tsx`):**
   - Split-screen verification workspace
   - Side-by-side encrypted prescription image viewer & AI matched items
   - Approval & rejection with mandatory reason recording
   - Drugs & Cosmetics Act Rule 65(9) Schedule H1 Register prompt
   - DPDP Act prescription access audit log
   - One-click generic substitution offer
3. **Store Order Screen (`StoreView.tsx`):**
   - Store order fulfillment queue scoped to store staff
   - Hard regulatory gate preventing packing/dispatch before pharmacist approval
   - Packing with billing software invoice number recording
   - Handover to local courier/delivery executive
4. **Central Operations & Executive Dashboard (`DashboardView.tsx`):**
   - 46-Store network summary table (Kolkata & Howrah)
   - Median verification SLA tracker (< 10 min benchmark)
   - Low-stock inventory alerts (<= 5 units)
   - Drugs & Cosmetics Act Schedule H1 Register compliance log
   - Daily 46-store stock CSV file uploader
   - Automated refill reminders engine trigger

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
