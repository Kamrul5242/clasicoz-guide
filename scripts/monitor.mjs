// Weekly visibility / entity / health monitor for clasicoz.shop + guide.clasicoz.shop.
// Free checks always run. Search, reputation and AI-citation checks run only when their API key
// is set (BRAVE_API_KEY, PERPLEXITY_API_KEY, BING_WEBMASTER_API_KEY); otherwise they're reported as skipped.
// Writes reports/latest.md, reports/<date>.md and reports/state.json; exits 0 always, and sets
// the step output `failures` so the workflow can open an issue.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';

const STORE = 'https://clasicoz.shop';
const GUIDE = 'https://guide.clasicoz.shop';
const DOMAINS = ['clasicoz.shop', 'guide.clasicoz.shop'];
const EXPECT_NS = ['adi.ns.cloudflare.com', 'lennon.ns.cloudflare.com'];
const SOCIAL = ['https://www.tiktok.com/@clasicoz.shop', 'https://www.instagram.com/clasicoz.shop/', 'https://www.facebook.com/clasicoz.shop.official'];
const AI_UAS = { GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'OAI-SearchBot': 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)', PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)', ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' };
const BRAND_QUERIES = ['clasicoz', 'clasicoz shop', 'clasicoz.shop', 'clasicoz reviews', 'clasicoz scam'];
const AI_QUESTIONS = [
  'What is Clasicoz Shop?',
  'Where can I buy funny Halloween t-shirts for teachers online?',
  'Is clasicoz.shop a legit store?',
];
const WRONG_ENTITY = /league of legends|esports|clasico bd|dhaka|football jersey/i;

const rows = []; // { area, check, status: 'ok'|'warn'|'fail'|'skip', detail }
const add = (area, check, status, detail = '') => rows.push({ area, check, status, detail: String(detail).slice(0, 300) });
const today = new Date().toISOString().slice(0, 10);
const timed = (p, ms = 20000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

let prev = {};
try { prev = JSON.parse(await readFile('reports/state.json', 'utf8')); } catch {}
const state = { date: today };

// ---------- 1. DNS & email ----------
async function doh(name, type) {
  const r = await timed(fetch(`https://dns.google/resolve?name=${name}&type=${type}`));
  const j = await r.json();
  return { status: j.Status, data: (j.Answer || []).map(a => String(a.data).replace(/\.$/, '')) };
}
try {
  const ns = await doh('clasicoz.shop', 'NS');
  const got = ns.data.map(s => s.toLowerCase()).sort();
  add('DNS', 'Nameservers are Cloudflare only', JSON.stringify(got) === JSON.stringify([...EXPECT_NS].sort()) ? 'ok' : 'fail', got.join(', ') || `status ${ns.status}`);
  const mx = await doh('clasicoz.shop', 'MX');
  add('DNS', 'MX records present', mx.data.length ? 'ok' : 'fail', mx.data.join(', '));
  const txt = await doh('clasicoz.shop', 'TXT');
  add('DNS', 'SPF record', txt.data.some(t => /v=spf1/.test(t)) ? 'ok' : 'warn', txt.data.find(t => /v=spf1/.test(t)) || 'missing');
  const dmarc = await doh('_dmarc.clasicoz.shop', 'TXT');
  add('DNS', 'DMARC record', dmarc.data.some(t => /v=DMARC1/.test(t)) ? 'ok' : 'warn', dmarc.data[0] || 'missing');
  const g = await doh('guide.clasicoz.shop', 'CNAME');
  add('DNS', 'guide CNAME -> GitHub Pages (DNS only)', g.data.some(d => /github\.io/.test(d)) ? 'ok' : 'fail', g.data.join(', ') || `status ${g.status}`);
} catch (e) { add('DNS', 'DNS lookups', 'fail', e.message); }

// ---------- 2. HTTPS ----------
for (const u of [`${STORE}/`, 'https://www.clasicoz.shop/', `${GUIDE}/`]) {
  try {
    const r = await timed(fetch(u, { redirect: 'manual' }));
    add('HTTPS', `Valid certificate: ${new URL(u).host}`, 'ok', `HTTP ${r.status}`);
  } catch (e) {
    const code = (e.cause && e.cause.code) || e.message;
    add('HTTPS', `Valid certificate: ${new URL(u).host}`, u.includes('www.') ? 'warn' : 'fail', code);
  }
}

// ---------- 3. Guide site & AI crawler access ----------
let products = [];
try { products = JSON.parse(await readFile('data/products.json', 'utf8')).products; } catch {}
try {
  const llms = await (await timed(fetch(`${GUIDE}/llms.txt`))).text();
  const missing = products.filter(p => !llms.includes(`${STORE}/${p.path}`));
  add('Guide', 'llms.txt lists every live product', missing.length ? 'warn' : 'ok', missing.length ? `${missing.length} missing, e.g. ${missing.slice(0, 3).map(p => p.path).join(', ')}` : `${products.length} products`);
  for (const f of ['sitemap.xml', 'store-sitemap.xml', 'robots.txt', 'logo.png', 'guides/']) {
    const r = await timed(fetch(`${GUIDE}/${f}`));
    add('Guide', `/${f} reachable`, r.ok ? 'ok' : 'fail', `HTTP ${r.status}`);
  }
} catch (e) { add('Guide', 'Guide files', 'fail', e.message); }
for (const [name, ua] of Object.entries(AI_UAS)) {
  try {
    const g = await timed(fetch(`${GUIDE}/`, { headers: { 'User-Agent': ua } }));
    const gl = (await g.text()).length;
    add('AI crawlers', `${name} can read guide`, g.ok && gl > 5000 ? 'ok' : 'fail', `HTTP ${g.status}, ${gl} bytes`);
    const s = await timed(fetch(`${STORE}/`, { headers: { 'User-Agent': ua } }));
    const sl = (await s.text()).length;
    add('AI crawlers', `${name} on store`, sl > 5000 ? 'ok' : 'info', `${sl} bytes${sl < 5000 ? ' (GearLaunch challenge page, known platform limit; the guide covers this)' : ' (store now readable!)'}`);
  } catch (e) { add('AI crawlers', name, 'warn', e.message); }
}

// ---------- 4. Store render (what Google sees) + entity consistency ----------
let storeOrg = null, guideOrg = null;
try {
  const html = await (await timed(fetch(`${GUIDE}/`))).text();
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { const j = JSON.parse(m[1]); if (j['@type'] === 'Organization') guideOrg = j; }
} catch {}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--headless=new', '--disable-blink-features=AutomationControlled'] });
try {
  const page = await (await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' })).newPage();
  const pages = ['/', products[0] ? '/' + products[0].path : null, '/_/support'].filter(Boolean);
  for (const path of pages) {
    await page.goto(STORE + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
    for (let i = 0; i < 45; i++) { if ((await page.title().catch(() => '')).toLowerCase().includes('clasicoz')) break; await page.waitForTimeout(1000); }
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4500);
    const r = await page.evaluate(() => {
      const lds = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean);
      return {
        title: document.title, desc: (document.querySelector('meta[name=description]') || {}).content || '',
        canonical: (document.querySelector('link[rel=canonical]') || {}).href || '', h1: document.querySelectorAll('h1').length,
        org: lds.find(j => j['@type'] === 'Organization') || null, types: lds.map(j => j['@type']),
        spam: /Keywords\s*:/i.test(document.body.innerText),
      };
    });
    const ok = r.title.length >= 30 && r.title.length <= 65 && r.desc.length >= 70 && r.canonical && r.h1 === 1 && !r.spam;
    add('Store SEO', `Rendered ${path}`, ok ? 'ok' : 'warn', `title ${r.title.length}ch, desc ${r.desc.length}ch, H1 x${r.h1}, canonical ${r.canonical ? 'yes' : 'NO'}, schema ${r.types.join('/')}${r.spam ? ', KEYWORDS SPAM VISIBLE' : ''}`);
    if (path === '/') storeOrg = r.org;
  }
} catch (e) { add('Store SEO', 'Render store pages', 'fail', e.message); }
await browser.close();

if (storeOrg && guideOrg) {
  const same = (a, b) => JSON.stringify([].concat(a || []).sort()) === JSON.stringify([].concat(b || []).sort());
  add('Entity', 'Brand name identical (store vs guide)', storeOrg.name === guideOrg.name ? 'ok' : 'fail', `${storeOrg.name} / ${guideOrg.name}`);
  add('Entity', 'Logo identical', (storeOrg.logo && storeOrg.logo.url) === (guideOrg.logo && guideOrg.logo.url) ? 'ok' : 'warn', storeOrg.logo && storeOrg.logo.url);
  add('Entity', 'Social profiles (sameAs) identical', same(storeOrg.sameAs, (guideOrg.sameAs || []).filter(u => !u.includes('guide.'))) ? 'ok' : 'warn', (storeOrg.sameAs || []).length + ' on store');
  add('Entity', 'Disambiguation statement present', storeOrg.disambiguatingDescription && guideOrg.disambiguatingDescription ? 'ok' : 'warn', '');
} else add('Entity', 'Organization data found on store and guide', 'fail', `store ${!!storeOrg}, guide ${!!guideOrg}`);
for (const u of SOCIAL) {
  try { const r = await timed(fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })); add('Entity', `Profile reachable: ${new URL(u).host}`, r.status < 400 ? 'ok' : 'warn', `HTTP ${r.status}`); }
  catch (e) { add('Entity', `Profile reachable: ${new URL(u).host}`, 'warn', e.message); }
}

// ---------- 5. Catalog drift & information gaps ----------
state.products = products.map(p => p.path);
const before = new Set(prev.products || []);
const added = state.products.filter(p => !before.has(p)), removed = [...before].filter(p => !state.products.includes(p));
add('Catalog', 'Live products', 'ok', `${products.length}${prev.products ? ` (added ${added.length}, removed ${removed.length})` : ''}`);
if (removed.length) add('Catalog', 'Products removed since last run', 'warn', removed.join(', '));
const spam = products.filter(p => /Keywords\s*:/i.test(p.description || ''));
add('Catalog', 'No "Keywords:" spam in descriptions', spam.length ? 'warn' : 'ok', spam.length ? `${spam.length}: ${spam.slice(0, 5).map(p => p.path).join(', ')}` : '');
const thin = products.filter(p => String(p.description || '').replace(/\s*Keywords\s*:[\s\S]*$/i, '').length < 200);
add('Gaps', 'Descriptions under 200 characters', thin.length ? 'warn' : 'ok', thin.map(p => p.path).slice(0, 8).join(', '));
let support = [];
try { support = JSON.parse(await readFile('data/support.json', 'utf8')).pages; } catch {}
const TOPICS = { 'shipping time': /arrive|ship out|delivery/i, 'shipping countries': /countries/i, returns: /return|refund/i, sizing: /fit|size/i, 'care/washing': /wash|care/i, payment: /payment/i, contact: /contact|touch/i };
const covered = Object.entries(TOPICS).filter(([, re]) => support.some(s => re.test(s.heading))).map(([k]) => k);
const uncovered = Object.keys(TOPICS).filter(k => !covered.includes(k));
add('Gaps', 'FAQ covers core buyer questions', uncovered.length ? 'warn' : 'ok', uncovered.length ? `missing: ${uncovered.join(', ')}` : `${covered.length} topics`);
const byTag = {};
products.forEach(p => (p.tags || []).forEach(t => { byTag[t] = (byTag[t] || 0) + 1; }));
const smallTags = Object.entries(byTag).filter(([, n]) => n < 5).map(([t, n]) => `${t} (${n})`);
add('Gaps', 'Collections with fewer than 5 designs (content/design gap)', smallTags.length ? 'warn' : 'ok', smallTags.join(', '));

// ---------- 6. Search visibility, competitors, reputation (Brave Search API) ----------
if (process.env.BRAVE_API_KEY) {
  state.serp = {};
  for (const q of BRAND_QUERIES) {
    try {
      const r = await timed(fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`, { headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY } }));
      const j = await r.json();
      const res = (j.web && j.web.results) || [];
      const pos = res.findIndex(x => DOMAINS.some(d => new URL(x.url).host.endsWith(d))) + 1;
      const others = [...new Set(res.map(x => new URL(x.url).host).filter(h => !DOMAINS.some(d => h.endsWith(d))))].slice(0, 4);
      state.serp[q] = pos;
      const moved = prev.serp && prev.serp[q] !== undefined ? ` (last week ${prev.serp[q] || 'not in top 10'})` : '';
      const negative = /scam|review/.test(q) ? res.filter(x => /scam|fraud|fake|complaint/i.test(x.title + ' ' + (x.description || ''))).map(x => new URL(x.url).host) : [];
      add('Search', `"${q}": our position`, pos === 1 ? 'ok' : pos ? 'warn' : 'fail', `${pos || 'not in top 10'}${moved}; others: ${others.join(', ')}${negative.length ? `; NEGATIVE MENTIONS: ${negative.join(', ')}` : ''}`);
    } catch (e) { add('Search', `"${q}"`, 'warn', e.message); }
  }
} else add('Search', 'Brand SERP, competitors, reputation', 'skip', 'add repo secret BRAVE_API_KEY (free tier: api.search.brave.com)');

// ---------- 7. AI answer visibility & citations (Perplexity API) ----------
if (process.env.PERPLEXITY_API_KEY) {
  for (const q of AI_QUESTIONS) {
    try {
      const r = await timed(fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: q }] }),
      }), 60000);
      const j = await r.json();
      const text = (j.choices && j.choices[0] && j.choices[0].message.content) || '';
      const cites = (j.citations || j.search_results || []).map(c => typeof c === 'string' ? c : c.url);
      const cited = cites.some(c => DOMAINS.some(d => String(c).includes(d)));
      const named = /clasicoz/i.test(text);
      const wrong = /what is clasicoz/i.test(q) && WRONG_ENTITY.test(text);
      add('AI answers', `Perplexity: "${q}"`, wrong ? 'fail' : cited ? 'ok' : named ? 'warn' : 'warn', `${cited ? 'cites our site' : 'not cited'}${named ? ', names brand' : ''}${wrong ? ', DESCRIBES WRONG ENTITY' : ''}; sources: ${cites.slice(0, 4).map(c => { try { return new URL(c).host; } catch { return c; } }).join(', ')}`);
    } catch (e) { add('AI answers', `Perplexity: "${q}"`, 'warn', e.message); }
  }
} else add('AI answers', 'AI citation checks (Perplexity)', 'skip', 'add repo secret PERPLEXITY_API_KEY (paid, a few cents per run)');

// ---------- 8. Bing Webmaster (queries, clicks) ----------
if (process.env.BING_WEBMASTER_API_KEY) {
  try {
    const r = await timed(fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats?siteUrl=${encodeURIComponent(STORE + '/')}&apikey=${process.env.BING_WEBMASTER_API_KEY}`));
    const j = await r.json();
    const d = j.d || [];
    const clicks = d.reduce((a, x) => a + (x.Clicks || 0), 0), imps = d.reduce((a, x) => a + (x.Impressions || 0), 0);
    add('Bing', 'Queries (recent)', 'ok', `${d.length} queries, ${imps} impressions, ${clicks} clicks; top: ${d.sort((a, b) => b.Impressions - a.Impressions).slice(0, 5).map(x => x.Query).join(', ')}`);
  } catch (e) { add('Bing', 'Bing Webmaster API', 'warn', e.message); }
} else add('Bing', 'Bing query stats', 'skip', 'add repo secret BING_WEBMASTER_API_KEY (Bing Webmaster > Settings > API access)');

// ---------- report ----------
const icon = { ok: '✅', warn: '⚠️', fail: '❌', skip: '⏭️', info: 'ℹ️' };
const fails = rows.filter(r => r.status === 'fail');
const warns = rows.filter(r => r.status === 'warn');
let md = `# Clasicoz monitor — ${today}\n\n**${fails.length} failing, ${warns.length} warnings, ${rows.filter(r => r.status === 'ok').length} ok, ${rows.filter(r => r.status === 'skip').length} skipped, ${rows.filter(r => r.status === 'info').length} info.**\n\n`;
for (const area of [...new Set(rows.map(r => r.area))]) {
  md += `## ${area}\n\n| | Check | Detail |\n|---|---|---|\n`;
  for (const r of rows.filter(x => x.area === area)) md += `| ${icon[r.status]} | ${r.check} | ${r.detail.replace(/\|/g, '/')} |\n`;
  md += '\n';
}
await mkdir('reports', { recursive: true });
await writeFile('reports/latest.md', md);
await writeFile(`reports/${today}.md`, md);
await writeFile('reports/state.json', JSON.stringify(state, null, 1));
console.log(md);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `failures=${fails.length}\n`);
