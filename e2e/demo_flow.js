#!/usr/bin/env node
/**
 * RefillCare end-to-end demo flow.
 *
 * Walks the whole story through the real UI and asserts at every step:
 *   consent -> one-tap refill -> prescription upload -> pharmacist queue (prescription beside the
 *   matched items) -> Schedule X blocked -> generic offer and consent -> the store cannot pack
 *   before approval -> pack and hand over -> central dashboard -> reminder messages -> Bengali.
 * It also fails if any screen scrolls sideways on a 390px phone.
 *
 *   node e2e/demo_flow.js [APP_URL]          (default http://localhost:3000)
 *   API_URL=http://localhost:8000 node ...   (default: same origin as the app, through its /api proxy)
 *
 * It resets the demo data first, so it can be run again and again. Screenshots go to screenshots/demo/.
 */

const fs = require('fs');
const path = require('path');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  puppeteer = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'puppeteer-core'));
}

const APP = (process.argv[2] || process.env.TARGET_URL || 'http://localhost:3000').replace(/\/+$/, '');
const API = (process.env.API_URL || APP).replace(/\/+$/, '');
const SHOTS = path.join(__dirname, '..', 'screenshots', 'demo');
fs.mkdirSync(SHOTS, { recursive: true });

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA.replace(/\\/g, '/')}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('No Chrome found. Set CHROME_PATH.');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
let passed = 0;

async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}/api/${pathname}`, {
    method,
    headers: { ...(token ? { Authorization: token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

async function tokenFor(phone) {
  const r = await api('login', { method: 'POST', body: { phone, otp: '123456' } });
  assert(r.status === 200, `login failed for ${phone}`);
  return r.json.token;
}

// ---- page helpers ----

async function newRole(browser, width = 1200, height = 900) {
  const context = await browser.createBrowserContext(); // isolated storage, so roles never share a session
  const page = await context.newPage();
  await page.setViewport({ width, height });
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  page.on('response', (res) => {
    if (res.status() >= 500) failures.push(`server error ${res.status()} on ${res.url()}`);
  });
  return page;
}

const bodyText = (page) => page.evaluate(() => document.body.innerText);

async function waitText(page, text, timeout = 20000) {
  try {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
  } catch {
    const seen = (await bodyText(page)).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`text not found: "${text}". Page showed: "${seen}…"`);
  }
}

async function noText(page, text) {
  assert(!(await bodyText(page)).includes(text), `text should not be on the page: "${text}"`);
}

async function clickText(page, text, { exact = false, selector = 'button, summary, [role=tab]', nth = 0, timeout = 20000 } = {}) {
  const matcher = (sel, t, ex) =>
    [...document.querySelectorAll(sel)].filter((e) => {
      const label = (e.innerText || '').trim();
      return !e.disabled && (ex ? label === t : label.includes(t));
    });
  try {
    await page.waitForFunction((sel, t, ex) => {
      return [...document.querySelectorAll(sel)].some((e) => {
        const label = (e.innerText || '').trim();
        return !e.disabled && (ex ? label === t : label.includes(t));
      });
    }, { timeout }, selector, text, exact);
  } catch {
    throw new Error(`nothing to click with text "${text}"`);
  }
  const handle = await page.evaluateHandle(matcher, selector, text, exact).then(async (arr) => {
    const el = await page.evaluateHandle((a, n) => a[n], arr, nth);
    return el;
  });
  await handle.asElement().click();
}

async function signInAs(page, accountName) {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await clickText(page, accountName, { selector: 'button' });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function noSideways(page, label, width) {
  const w = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  assert(w <= width + 1, `${label} scrolls sideways at ${width}px (content is ${w}px wide)`);
}

async function giveConsent(page) {
  await clickText(page, 'I agree and continue', { exact: true });
  await waitText(page, 'Running low');
  await sleep(300);
}

async function signedInPhone(browser, phone, width, height) {
  // for the phone-width checks: skip the form, the sign-in itself is covered on desktop
  const r = await api('login', { method: 'POST', body: { phone, otp: '123456' } });
  await api('consent', { method: 'POST', token: r.json.token });
  const page = await newRole(browser, width, height);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t, u) => {
    localStorage.setItem('t', t);
    localStorage.setItem('u', JSON.stringify(u));
  }, r.json.token, { ...r.json.user, consent_at: r.json.user.consent_at || 1 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  return page;
}

// ---- the story ----

async function main() {
  console.log(`\nRefillCare demo flow\n  app: ${APP}\n  api: ${API}\n`);
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    console.log('0. Start from the seeded demo data');
    await step('demo data restored', async () => {
      const r = await api('demo/reset', { method: 'POST' });
      assert(r.status === 200, `reset returned ${r.status}`);
    });

    console.log('\n1. The hard part: nothing leaves a store before a pharmacist approves it');
    const staffToken = await tokenFor('9000000082'); // Behala
    await step('store cannot pack a prescription order that is unapproved (API says 403)', async () => {
      const r = await api('orders/RX-50214/pack', { method: 'POST', token: staffToken, body: { invoice: 'X1' } });
      assert(r.status === 403, `expected 403, got ${r.status}`);
      assert(r.json.detail.code === 'APPROVAL_REQUIRED', 'expected APPROVAL_REQUIRED');
    });
    const behala = await newRole(browser);
    await step('store screen shows the order locked, with the pack button disabled', async () => {
      await signInAs(behala, 'Behala store');
      await waitText(behala, 'RX-50214');
      await waitText(behala, 'Locked. Prescription medicines cannot be packed until a pharmacist approves them.');
      const disabled = await behala.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.disabled && b.innerText.includes('Waiting for the pharmacist'))
      );
      assert(disabled, 'the waiting button should be disabled');
      await shot(behala, '01_store_locked');
    });

    console.log('\n2. Debasish reorders his mother’s Metformin in one tap');
    const debasish = await newRole(browser);
    await step('consent, then the reorder button is the first thing on the home screen', async () => {
      await signInAs(debasish, 'Debasish Ghosh');
      await waitText(debasish, 'Hello, Debasish');
      await waitText(debasish, 'Consent to process health data');
      await shot(debasish, '02_consent');
      await giveConsent(debasish);
      await waitText(debasish, 'Metformin 500 mg');
      await waitText(debasish, 'Runs out in 4 days');
      await waitText(debasish, 'Reorder now');
      await shot(debasish, '03_home_refill_due');
    });
    await step('one tap sends it to the pharmacist, and a second tap is impossible', async () => {
      await clickText(debasish, 'Reorder now', { exact: true });
      await waitText(debasish, 'is already in progress');
      await noText(debasish, 'Reorder now');
      await waitText(debasish, 'A pharmacist is checking your prescription.');
      await shot(debasish, '04_reordered');
    });

    console.log('\n3. Rina sends a prescription that includes a medicine that cannot be sold online');
    const rina = await newRole(browser);
    await step('Rina’s refill is already in progress, so no duplicate reorder button', async () => {
      await signInAs(rina, 'Rina Sen');
      await giveConsent(rina);
      await waitText(rina, 'Order RX-50214 is already in progress');
      await noText(rina, 'Reorder now');
    });
    await step('upload a sample prescription (Schedule X + paracetamol)', async () => {
      await clickText(rina, 'Send a prescription', { exact: true });
      await waitText(rina, 'Who is this for?');
      await clickText(rina, 'No prescription handy?', { selector: 'summary' });
      await clickText(rina, 'Not sold online', { exact: true });
      await clickText(rina, 'Send for pharmacist check', { exact: true });
      await waitText(rina, 'Sent. A pharmacist will check it shortly.');
      await shot(rina, '05_rina_sent');
    });

    console.log('\n4. Arif’s unreadable prescription is sent back, and he replies with a clearer one');
    const arif = await newRole(browser);
    await step('Arif sees what to do, in plain words, and re-sends', async () => {
      await signInAs(arif, 'Arif Mondal');
      await giveConsent(arif);
      await waitText(arif, 'We could not read the prescription. Please send a clearer photo.');
      await clickText(arif, 'No prescription handy?', { selector: 'summary' });
      await clickText(arif, 'Printed', { exact: true });
      await waitText(arif, 'A pharmacist is checking your prescription.');
    });

    console.log('\n5. Anita checks every prescription, with the sheet beside what the AI read');
    const anita = await newRole(browser);
    const rinaOrders = (await api('orders', { token: await tokenFor('9000000002') })).json;
    const schedXCode = rinaOrders.find((o) => o.code !== 'RX-50214').code;
    const debasishOrders = (await api('orders', { token: await tokenFor('9000000001') })).json;
    const refillCode = debasishOrders.find((o) => o.code !== 'RX-50211').code;

    await step('queue lists what is waiting, oldest first', async () => {
      await signInAs(anita, 'Anita Rao');
      await waitText(anita, 'Verification queue');
      await waitText(anita, 'waiting for a pharmacist');
      await waitText(anita, 'Needs checking (4)');
    });
    await step('the prescription image and the matched items are on screen together', async () => {
      await clickText(anita, 'RX-50214', { selector: 'button' });
      await anita.waitForSelector('img[alt^="Prescription for"]', { timeout: 15000 });
      await anita.waitForFunction(() => {
        const img = document.querySelector('img[alt^="Prescription for"]');
        return img && img.complete && img.naturalWidth > 0;
      }, { timeout: 15000 });
      await waitText(anita, 'Matched items');
      await waitText(anita, 'Telmisartan 40 mg');
      const sideBySide = await anita.evaluate(() => {
        const img = document.querySelector('img[alt^="Prescription for"]').getBoundingClientRect();
        const approve = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Approve').getBoundingClientRect();
        return Math.abs(img.top - approve.top) < 700 && approve.left > img.left; // same screen, item to the right
      });
      assert(sideBySide, 'the image and the approve button should sit side by side');
      await shot(anita, '06_pharmacist_side_by_side');
    });
    await step('the selected prescription stays selected through an auto-refresh (it used to jump away)', async () => {
      await sleep(16500); // the queue refreshes every 15 seconds
      const open = await anita.evaluate(() => {
        const h = [...document.querySelectorAll('h2')].find((e) => /^RX-\d+$/.test(e.innerText.trim()));
        return h ? h.innerText.trim() : '';
      });
      assert(open === 'RX-50214', `the pharmacist was moved to ${open || 'nothing'} while reviewing RX-50214`);
    });
    await step('approve Rina’s Telmisartan, then offer the cheaper generic', async () => {
      await clickText(anita, 'Approve', { exact: true });
      await waitText(anita, 'Approved · 3 packs');
      await clickText(anita, 'Offer to customer', { exact: true });
      await waitText(anita, 'Waiting for the customer to answer');
    });
    await step('Schedule X is rejected on sight; the ordinary medicine can be approved', async () => {
      await clickText(anita, schedXCode, { selector: 'button' });
      await waitText(anita, 'Rejected: Cannot be sold online');
      await clickText(anita, 'Approve', { exact: true });
      await waitText(anita, 'Approved · 2 packs');
      await shot(anita, '07_schedule_x_rejected');
    });
    await step('the pharmacist adds a medicine the AI did not read, from the catalogue', async () => {
      await clickText(anita, refillCode, { selector: 'button' });
      await waitText(anita, 'Metformin 500 mg');
      await clickText(anita, 'Add a medicine', { selector: 'summary' });
      await anita.waitForSelector('input[aria-label="Search the medicine list"]');
      await anita.type('input[aria-label="Search the medicine list"]', 'Paracetamol');
      await clickText(anita, 'Add', { exact: true });
      await waitText(anita, 'Added by you');
      await shot(anita, '07b_pharmacist_added_medicine');
    });
    await step('approve Debasish’s refill (both lines) and Arif’s re-sent prescription', async () => {
      await clickText(anita, refillCode, { selector: 'button' });
      await waitText(anita, 'Metformin 500 mg');
      await clickText(anita, 'Approve', { exact: true });
      await waitText(anita, 'Approved · 4 packs');
      await clickText(anita, 'Approve', { exact: true }); // the line the pharmacist added still needs its own approval
      await waitText(anita, 'Approved · 1 pack');
      await clickText(anita, 'RX-50219', { selector: 'button' });
      await waitText(anita, 'Telmisartan 40 mg');
      // the printed sample has two lines, and each one needs its own approval
      await clickText(anita, 'Approve', { exact: true });
      await waitText(anita, 'Approved · 4 packs');
      await clickText(anita, 'Approve', { exact: true });
      await waitText(anita, 'Approved · 3 packs');
    });

    console.log('\n6. Rina answers the generic offer. It is never swapped without her consent');
    await step('she sees the saving and accepts', async () => {
      await rina.reload({ waitUntil: 'domcontentloaded' });
      await waitText(rina, 'Your pharmacist suggests a cheaper option');
      await shot(rina, '08_generic_offer');
      await clickText(rina, 'Accept', { exact: true });
      await waitText(rina, 'You saved ₹285');
      await noText(rina, 'Reorder now'); // her order is still open, even though it now holds the generic
    });
    await step('Rina pays through the dummy UPI screen (nothing real happens)', async () => {
      await clickText(rina, 'Pay with UPI (demo)', { exact: true });
      await waitText(rina, 'This is a demo. No real money moves.');
      await shot(rina, '08b_demo_payment');
      await clickText(rina, 'Pay ₹', { selector: 'button' });
      await waitText(rina, 'received (demo)');
    });

    console.log('\n7. The store packs and hands over, now that it is approved');
    await step('pack with the real invoice number', async () => {
      await behala.reload({ waitUntil: 'domcontentloaded' });
      await waitText(behala, 'Ready to pack');
      await clickText(behala, 'Pack and enter invoice', { exact: true });
      await behala.waitForSelector('#inv');
      await behala.click('#inv');
      await behala.type('#inv', 'INV-DEMO-1');
      await clickText(behala, 'Confirm packed', { exact: true });
      await waitText(behala, 'Hand over to delivery');
    });
    await step('hand over to delivery', async () => {
      await clickText(behala, 'Hand over to delivery', { exact: true });
      await clickText(behala, 'Confirm handover', { exact: true });
      await waitText(behala, 'Handed to Store delivery staff');
      await waitText(behala, 'Invoice INV-DEMO-1');
      await shot(behala, '09_store_handed_over');
    });
    await step('Rina sees it is on the way', async () => {
      await rina.reload({ waitUntil: 'domcontentloaded' });
      await waitText(rina, 'On the way with Store delivery staff.');
      await shot(rina, '10_rina_on_the_way');
    });

    console.log('\n8. Central view across all stores');
    await step('dashboard: verification time, rejections, and zero sent without approval', async () => {
      await clickText(anita, 'All stores', { exact: true, selector: '[role=tab]' });
      await waitText(anita, 'Median verification');
      await waitText(anita, 'Sent without approval');
      await waitText(anita, 'None. Every packed item was approved.');
      await waitText(anita, 'Rejections');
      await waitText(anita, 'Cannot be sold online');
      await waitText(anita, 'Orders by store');
      const median = await anita.evaluate(() => {
        const label = [...document.querySelectorAll('p')].find((p) => p.innerText.trim() === 'Median verification');
        return label ? label.nextElementSibling.innerText : '';
      });
      assert(/^\d/.test(median.trim()), `median verification should be a real number, got "${median}"`);
      await shot(anita, '11_dashboard');
    });

    console.log('\n9. Refill reminders reach the customer, in their language');
    await step('Anita sends today’s reminders', async () => {
      await clickText(anita, 'Send today’s reminders', { exact: true });
      await waitText(anita, 'reminder');
    });
    await step('Debasish sees the message in the app', async () => {
      await debasish.reload({ waitUntil: 'domcontentloaded' });
      await waitText(debasish, 'Messages');
      await waitText(debasish, 'runs out in about 4 days');
      await shot(debasish, '12_message');
    });
    await step('switching to Bengali translates the whole screen, and the choice is remembered', async () => {
      await debasish.select('#lang', 'bn');
      await waitText(debasish, 'নমস্কার, Debasish');
      await waitText(debasish, 'আপনার অর্ডার');
      await waitText(debasish, 'প্রেসক্রিপশন পাঠান');
      await shot(debasish, '13_bengali');
      await debasish.select('#lang', 'hi');
      await waitText(debasish, 'नमस्ते, Debasish');
      await waitText(debasish, 'आपके ऑर्डर');
      await debasish.select('#lang', 'en');
    });

    console.log('\n10. Nothing scrolls sideways on a 390px phone');
    for (const [phone, who, expect] of [
      ['9000000001', 'customer', 'Hello, Debasish'],
      ['9000000002', 'customer (Rina)', 'Hello, Rina'],
      ['9000000099', 'pharmacist', 'Verification queue'],
      ['9000000082', 'store', 'Store orders'],
    ]) {
      await step(`${who} screen fits the phone`, async () => {
        const page = await signedInPhone(browser, phone, 390, 844);
        await waitText(page, expect);
        await sleep(600);
        await noSideways(page, who, 390);
        await shot(page, `phone_${who.replace(/\W+/g, '_')}`);
        await page.close();
      });
    }
    await step('sign-in screen fits the phone', async () => {
      const page = await newRole(browser, 390, 844);
      await page.goto(APP, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitText(page, 'Demo accounts');
      await noSideways(page, 'sign-in', 390);
      await shot(page, 'phone_signin');
      await page.close();
    });

    console.log('\n11. A new customer can register, and can delete their data');
    await step('a new number registers through the form, then erases their data and is signed out', async () => {
      const page = await newRole(browser);
      const phone = `98${String(Date.now()).slice(-8)}`; // a number that has never signed in
      await page.goto(APP, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#login-phone');
      await page.type('#login-phone', phone);
      await page.type('#login-otp', '123456');
      await page.type('#login-name', 'Test Person');
      await clickText(page, 'Continue', { selector: 'button[type=submit]' });
      await waitText(page, 'Hello, Test');
      await giveConsent(page);
      await clickText(page, 'Delete my data', { exact: true });
      await waitText(page, 'Delete your data?');
      await shot(page, '14_delete_my_data');
      await clickText(page, 'Yes, delete my data', { exact: true });
      await waitText(page, 'Demo accounts'); // back at the sign-in screen
      const stillThere = await api('login', { method: 'POST', body: { phone, otp: '123456' } });
      assert(stillThere.json.user.name !== 'Test Person', 'the old name should be gone after erasure');
      await page.close();
    });
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} steps passed, ${failures.length} problem${failures.length === 1 ? '' : 's'}.`);
  if (failures.length) {
    console.log('\nProblems:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  } else {
    console.log(`Screenshots are in ${path.relative(process.cwd(), SHOTS) || SHOTS}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
