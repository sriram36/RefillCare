#!/usr/bin/env node
/**
 * RefillCare Automated End-to-End Smoke Test
 * Tests core authentication and role-specific screens across Customer, Pharmacist,
 * Central Operations Dashboard, and Store Staff portals.
 *
 * Usage:
 *   node e2e/smoke.js [TARGET_URL]
 * Default TARGET_URL: https://refillcare.vercel.app
 */

const fs = require('fs');
const path = require('path');
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  puppeteer = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));
}

function getChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error('Chrome executable not found. Set CHROME_PATH environment variable.');
}

const TARGET_URL = process.argv[2] || process.env.TARGET_URL || 'https://refillcare.vercel.app';
const DEMO_OTP = '123456';

async function runRoleLogin(page, phone, expectedText, roleName) {
  console.log(`\n[${roleName}] Testing login with phone ${phone}...`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

  // Type credentials into the login form
  await page.waitForSelector('#ph', { timeout: 15000 });
  await page.type('#ph', phone);
  await page.type('#otp', DEMO_OTP);

  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/login')),
    page.click('button[type="submit"]')
  ]);

  if (response.status() !== 200) {
    throw new Error(`Login API returned HTTP ${response.status()}`);
  }

  // Wait for role-specific content to render
  await page.waitForFunction(
    (text) => document.body.innerText.includes(text),
    { timeout: 15000 },
    expectedText
  );

  console.log(`  ✓ ${roleName} successfully authenticated and verified: "${expectedText}" rendered.`);
}

async function main() {
  console.log('====================================================');
  console.log(`Starting RefillCare Smoke Test against: ${TARGET_URL}`);
  console.log('====================================================');

  const chromePath = getChromePath();
  console.log(`Using Chrome binary: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  let passed = 0;
  let failed = 0;

  try {
    // 1. Landing Page Test
    console.log('\n[Landing Page] Loading unauthenticated entry screen...');
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
    const title = await page.title();
    console.log(`  Title: "${title}"`);
    const pageText = await page.evaluate(() => document.body.innerText);
    if (!pageText.includes('RefillCare')) {
      throw new Error('Landing page missing RefillCare brand');
    }
    console.log('  ✓ Landing page rendered with branding and trust badges.');
    await page.close();
    passed++;

    // 2. Customer Portal Test (Debasish Ghosh)
    const customerPage = await browser.newPage();
    await customerPage.setViewport({ width: 1280, height: 800 });
    await runRoleLogin(customerPage, '9000000001', 'Debasish Ghosh', 'Customer');
    await customerPage.close();
    passed++;

    // 3. Pharmacist Verification Portal Test (Anita Rao)
    const phPage = await browser.newPage();
    await phPage.setViewport({ width: 1280, height: 800 });
    await runRoleLogin(phPage, '9000000099', 'Anita Rao', 'Pharmacist');
    // Test Central Operations Dashboard switch
    const dashBtn = await phPage.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.innerText.includes('Central Operations'));
    });
    if (dashBtn) {
      console.log('  Testing tab switch to Central Operations Dashboard...');
      await dashBtn.click();
      await phPage.waitForFunction(
        () => document.body.innerText.includes('Central Operations Dashboard') || document.body.innerText.includes('Managing Director View'),
        { timeout: 15000 }
      );
      console.log('  ✓ Central Operations Dashboard rendered.');
    }
    await phPage.close();
    passed++;

    // 4. Store Fulfillment Staff Test (Salt Lake Store)
    const storePage = await browser.newPage();
    await storePage.setViewport({ width: 1280, height: 800 });
    await runRoleLogin(storePage, '9000000081', 'Fulfillment', 'Store Staff');
    await storePage.close();
    passed++;

    console.log('\n====================================================');
    console.log(`Smoke Test Complete: ${passed} PASSED, ${failed} FAILED.`);
    console.log('====================================================');
  } catch (err) {
    failed++;
    console.error('\n❌ Smoke Test Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
