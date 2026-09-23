// Pulls the live Clasicoz catalog + support answers through a real (headless) Chrome.
// The store sits behind a JS challenge (rhino-core-shield): plain HTTP clients get a
// ~500-byte stub, while a browser that runs the challenge gets the real API.
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const ORIGIN = 'https://clasicoz.shop';
const LIST_API = `${ORIGIN}/api/storefrontpage/ahBzfmdlYXJsYXVuY2gtaHViciMLEgVTdG9yZRj-rbv3agwLEgpTdG9yZWZyb250GO7n1PZqDA/campaigns`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// Customer-facing support questions. The support index also links generic platform pages
// (jewelry, puzzles, CVV help...) that don't apply to this store, so the list is fixed.
const SUPPORT_SLUGS = [
  'what-type-of-products-do-you-offer', 'how-does-the-clothing-generally-fit', 'my-shirt-doesnt-fit-what-do-i-do',
  'do-you-offer-tall-maternity-or-plus-sizes', 'how-should-i-wash-and-care-for-my-apparel-purchase',
  'shipping-rates', 'what-countries-do-you-ship-to', 'when-will-my-order-ship-out',
  'when-will-my-order-arrive-can-it-be-expedited', 'can-i-track-my-order', 'can-i-change-or-cancel-my-order',
  'what-is-your-return-and-refund-policy', 'what-do-i-do-if-there-is-something-wrong-with-my-order',
  'what-payment-methods-do-you-accept', 'do-you-charge-sales-tax-or-vat', 'do-you-have-gift-cards', 'contact',
];

const browser = await chromium.launch({
  headless: true,
  // Real Chrome in new-headless mode passes the store's challenge; the stripped headless shell doesn't.
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chromium' }),
  args: ['--headless=new', '--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();

async function fail(code, msg) {
  console.error('FAIL: ' + msg);
  await browser.close();
  process.exit(code);
}

async function passChallenge(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  for (let i = 0; i < 45; i++) {
    const title = await page.title().catch(() => '');
    if (title.toLowerCase().includes('clasicoz')) {
      // The challenge reloads the page once solved; let that settle before running code in it.
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

// page.evaluate dies if the SPA navigates mid-call; retry a few times.
async function evalRetry(fn, arg) {
  for (let attempt = 1; ; attempt++) {
    try { return await page.evaluate(fn, arg); }
    catch (e) {
      if (attempt >= 4 || !/context was destroyed|navigation/i.test(String(e))) throw e;
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }
}

if (!(await passChallenge(ORIGIN + '/'))) await fail(2, 'could not pass the store challenge');
await page.waitForTimeout(3000);

// 1) Catalog list. `cursor` is a zero-based page index; `more` says whether another page exists.
const list = await evalRetry(async (base) => {
  const byPath = new Map();
  for (let pageNo = 0; pageNo < 50; pageNo++) {
    const r = await fetch(`${base}?cursor=${pageNo}&limit=40`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('list HTTP ' + r.status);
    const j = await r.json();
    for (const c of j.results || []) if (c.path && !byPath.has(c.path)) byPath.set(c.path, c);
    if (!j.more || !(j.results || []).length) break;
  }
  return [...byPath.values()].map(c => ({
    path: c.path, name: c.name, price: c.variantPrice, tags: (c.tags || []).filter(t => t !== 'storefront'),
    // designMockupUrl is the blank garment; only mockupUrlSmall has the print composited on (signed URL, 480px).
    image: c.mockupUrlSmall || c.designMockupUrl, thumb: c.mockupUrlSmall, stealthy: !!c.stealthy,
  }));
}, LIST_API);

// `end` dates are stale on evergreen campaigns (countdowns are off), so only hidden campaigns are
// dropped here; ended ones are dropped below using the product page's own `active` flag.
const live = list.filter(p => !p.stealthy);
console.log(`list: ${list.length} unique, ${live.length} visible`);

// 2) Per-product detail, parsed from the product page's inline `globalCampaign = {...}` JSON.
const details = await evalRetry(async (paths) => {
  function extractObject(src, marker) {
    const s = src.indexOf(marker);
    if (s < 0) return null;
    let i = src.indexOf('{', s), depth = 0, inStr = false, esc = false;
    const start = i;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    return null;
  }
  const out = {};
  for (const p of paths) {
    try {
      const html = await (await fetch('/' + p)).text();
      const raw = extractObject(html, 'globalCampaign =');
      if (!raw) { out[p] = { error: 'no-campaign' }; continue; }
      const c = JSON.parse(raw);
      const products = [];
      const seenTypes = new Set();
      for (const v of c.variants || []) {
        if (!v || typeof v !== 'object') continue;
        const type = v.displayName || v.productName || v.name;
        if (!type || seenTypes.has(type)) continue;
        seenTypes.add(type);
        const colors = (v.colors || []).filter(x => x && typeof x === 'object').map(x => x.name || x.pretty).filter(Boolean);
        const sizes = [];
        for (const col of v.colors || []) for (const sz of (col && col.sizes) || []) {
          const n = sz && (sz.pretty || sz.name);
          if (n && !sizes.includes(n)) sizes.push(n);
        }
        products.push({
          type,
          category: (v.productCategory && v.productCategory.displayName) || null,
          price: (v.price && (v.price.pretty || v.price.str)) || null,
          colors: colors.slice(0, 30),
          sizes: sizes.slice(0, 15),
        });
      }
      out[p] = { title: c.name || null, description: c.descriptionPlain || null, active: c.active !== false, products };
    } catch (e) { out[p] = { error: String(e).slice(0, 120) }; }
  }
  return out;
}, live.map(p => p.path));

// 3) Support answers.
const support = [];
for (const slug of SUPPORT_SLUGS) {
  const path = '/_/support/' + slug;
  try {
    await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.col-sm-7.col-sm-offset-1 h2'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const d = await page.evaluate(() => {
      const col = document.querySelector('.col-sm-7.col-sm-offset-1');
      const h = col && col.querySelector('h2');
      if (!h) return null;
      const heading = h.innerText.trim();
      let text = h.parentElement.innerText.trim();
      if (text.startsWith(heading)) text = text.slice(heading.length).trim();
      return { heading, text: text.replace(/\n{3,}/g, '\n\n').slice(0, 6000) };
    });
    if (d && d.text.length > 40) support.push({ path, ...d });
  } catch { /* one bad page shouldn't sink the run */ }
}

await browser.close();

const products = live
  .map(p => ({ ...p, ...(details[p.path] || {}) }))
  .filter(p => !p.error && p.active !== false);
const errors = live.filter(p => details[p.path] && details[p.path].error).map(p => p.path);

// Never overwrite a good dataset with an obviously broken one.
let previous = 0;
try { previous = JSON.parse(await readFile('data/products.json', 'utf8')).products.length; } catch {}
if (products.length === 0 || (previous && products.length < previous * 0.5)) {
  console.error(`FAIL: suspicious product count ${products.length} (previous ${previous}); keeping old data`);
  process.exit(3);
}

const fetchedAt = new Date().toISOString();
await mkdir('data', { recursive: true });
await writeFile('data/products.json', JSON.stringify({ fetchedAt, products }, null, 1));
if (support.length >= 5) await writeFile('data/support.json', JSON.stringify({ fetchedAt, pages: support }, null, 1));
console.log(`OK products=${products.length} detailErrors=${errors.length} support=${support.length}/${SUPPORT_SLUGS.length}`);
if (errors.length) console.log('detail errors: ' + errors.join(', '));
