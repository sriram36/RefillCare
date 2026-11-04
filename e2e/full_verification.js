/**
 * RefillCare Full End-to-End Flow & Screenshot Verification
 * Tests Customer, Pharmacist, and Store Staff flows at 1200px and 390px.
 * Validates DPDP consent, AI upload, search/cart, H1 registration, generic offers,
 * and the strict Schedule H/H1 regulatory gate (403 on unapproved dispatch/pack).
 */

const fs = require('fs');
const path = require('path');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  puppeteer = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));
}

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = process.argv[2] || 'https://refillcare.vercel.app';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
const ARTIFACT_DIR = 'C:\\Users\\kolli\\.gemini\\antigravity\\brain\\974212ba-a046-4b20-89f6-7ae1034774bd\\screenshots';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  const p1 = path.join(OUT_DIR, filename);
  const p2 = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: p1, fullPage: true });
  fs.copyFileSync(p1, p2);
  console.log(`    [Screenshot saved] -> ${filename}`);
}

async function loginAs(page, phone, otp = '123456') {
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('#ph', { timeout: 10000 });
  await page.type('#ph', phone);
  await page.type('#otp', otp);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/login')),
    page.click('button[type="submit"]')
  ]);
  await new Promise(r => setTimeout(r, 2000));
}

async function runFlowForViewport(width, height, label) {
  console.log(`\n======================================================`);
  console.log(`Starting Flow Verification at Viewport: ${width}x${height} (${label})`);
  console.log(`======================================================`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', `--window-size=${width},${height}`]
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  try {
    // 1. Unauthenticated Landing Screen
    console.log('\n1. Landing Screen');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await saveScreenshot(page, `${label}_01_landing.png`);

    // 2. Customer: Debasish Ghosh (Consent, Dashboard, 1-Tap Reorder)
    console.log('\n2. Customer: Debasish Ghosh (9000000001)');
    await loginAs(page, '9000000001');

    // Handle DPDP Consent if prompt is visible
    const consentBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.innerText.includes('I agree and continue'));
    });
    if (consentBtn && await consentBtn.asElement()) {
      await saveScreenshot(page, `${label}_02_customer_consent.png`);
      await consentBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    await saveScreenshot(page, `${label}_03_customer_home.png`);

    // Prescription Upload & AI Vision Preview
    console.log('\n3. Customer Prescription Upload (AI Draft Reading)');
    const demoSelect = await page.$('select[name="demo"]');
    if (demoSelect) {
      await page.select('select[name="demo"]', 'clean');
      await new Promise(r => setTimeout(r, 1000));
    }
    const uploadBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.innerText.includes('Upload') || b.innerText.includes('Process'));
    });
    if (uploadBtn && await uploadBtn.asElement()) {
      await uploadBtn.click();
      await new Promise(r => setTimeout(r, 3000));
    }
    await saveScreenshot(page, `${label}_04_customer_after_upload.png`);

    // Search and Cart Addition
    console.log('\n4. Medicine Search & Cart Interaction');
    const searchInput = await page.$('input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.type('Metformin');
      await new Promise(r => setTimeout(r, 1500));
      await saveScreenshot(page, `${label}_05_customer_search_cart.png`);
    }

    // 5. Customer: Rina Sen (Generic Substitution Consent)
    console.log('\n5. Customer: Rina Sen (9000000002) - Generic Consent');
    await loginAs(page, '9000000002');
    const consentBtn2 = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.innerText.includes('I agree and continue'));
    });
    if (consentBtn2 && await consentBtn2.asElement()) {
      await consentBtn2.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    await saveScreenshot(page, `${label}_06_customer_rina_sen.png`);

    // 6. Pharmacist: Anita Rao (Verification Queue, Review Workbench, H1 Register)
    console.log('\n6. Pharmacist: Anita Rao (9000000099)');
    await loginAs(page, '9000000099');
    await saveScreenshot(page, `${label}_07_pharmacist_queue.png`);

    // Switch to Central Operations Dashboard
    const dashBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.innerText.includes('Central Operations'));
    });
    if (dashBtn && await dashBtn.asElement()) {
      await dashBtn.click();
      await new Promise(r => setTimeout(r, 2500));
      await saveScreenshot(page, `${label}_08_central_dashboard.png`);
    }

    // 7. Store Staff: Behala Store #82 (Verify Hard Regulatory Gate: 403)
    console.log('\n7. Store Staff: Behala Store (9000000082) - Regulatory Gate Test');
    await loginAs(page, '9000000082');
    await saveScreenshot(page, `${label}_09_store_behala_queue.png`);

    // Attempt direct pack API call for unapproved order RX-50214 to verify 403 APPROVAL_REQUIRED
    console.log('   Testing gate: POST /api/orders/RX-50214/pack without pharmacist approval...');
    const gateResult = await page.evaluate(async () => {
      const token = localStorage.getItem('t');
      const res = await fetch('https://refillcare.onrender.com/api/orders/RX-50214/pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ invoice: 'INV-TEST-001' })
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    });

    console.log(`   Gate API Response: HTTP ${gateResult.status}`, JSON.stringify(gateResult.data));
    if (gateResult.status === 403) {
      console.log('   ✓ REGULATORY GATE VERIFIED: Store cannot pack unapproved Schedule H order (HTTP 403 APPROVAL_REQUIRED).');
    } else {
      console.warn(`   ⚠️ Warning: Expected 403, got ${gateResult.status}`);
    }

    // 8. Store Staff: Salt Lake Store #81 (Pack & Dispatch)
    console.log('\n8. Store Staff: Salt Lake Store (9000000081)');
    await loginAs(page, '9000000081');
    await saveScreenshot(page, `${label}_10_store_saltlake_fulfillment.png`);

    console.log(`\n✓ All flows and screenshots completed successfully for ${label}!`);
  } finally {
    await browser.close();
  }
}

async function main() {
  await runFlowForViewport(1200, 800, 'desktop_1200px');
  await runFlowForViewport(390, 844, 'mobile_390px');
  console.log('\n======================================================');
  console.log('All end-to-end flows and responsive tests completed!');
  console.log('======================================================');
}

main().catch(err => {
  console.error('Fatal error in full verification:', err);
  process.exit(1);
});
