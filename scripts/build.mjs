// Builds the static guide site from data/products.json + data/support.json into site/.
// Everything is plain HTML so crawlers that don't run JavaScript (GPTBot, PerplexityBot,
// ClaudeBot...) read the full content.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';

const SITE = 'https://guide.clasicoz.shop';
const STORE = 'https://clasicoz.shop';
const BRAND = 'Clasicoz Shop';
const SOCIAL = [
  'https://www.tiktok.com/@clasicoz.shop',
  'https://www.instagram.com/clasicoz.shop/',
  'https://www.facebook.com/clasicoz.shop.official',
];
const COLLECTIONS = {
  christmas: { name: 'Christmas', blurb: 'Funny and heartfelt Christmas designs for families, moms, grandmas, teachers and pet parents.' },
  halloween: { name: 'Halloween', blurb: 'Spooky, witchy and punny Halloween designs for adults, teachers, nurses and trades.' },
  nurse: { name: 'Nurses', blurb: 'Designs made for nurses and healthcare workers.' },
  'new-year': { name: 'New Year', blurb: 'New Year and countdown designs.' },
};

const { products: raw, fetchedAt } = JSON.parse(await readFile('data/products.json', 'utf8'));
let support = [];
try { support = JSON.parse(await readFile('data/support.json', 'utf8')).pages; } catch {}

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cleanDesc = s => String(s || '').replace(/\s*\bKeywords\s*:[\s\S]*$/i, '').replace(/\s+/g, ' ').trim();
const money = s => { const m = String(s || '').match(/[\d.]+/); return m ? Number(m[0]) : null; };
const prettyType = t => {
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bIphone\b/, 'iPhone').replace(/^Mug$/, 'Mug (11 oz)');
};
const shortName = n => String(n).split('|')[0].trim();
const firstSentence = t => { const m = String(t).replace(/\s+/g, ' ').match(/^.{20,260}?[.!?](\s|$)/); return m ? m[0].trim() : String(t).slice(0, 200); };
const jsonld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const today = new Date(fetchedAt || Date.now()).toISOString().slice(0, 10);

const products = raw.map(p => {
  const types = (p.products || []).map(t => ({ ...t, type: prettyType(t.type) }));
  const prices = types.map(t => money(t.price)).filter(n => n != null);
  const tee = types.find(t => /tee/i.test(t.type));
  return {
    ...p,
    short: shortName(p.name),
    desc: cleanDesc(p.description),
    types,
    low: prices.length ? Math.min(...prices) : money(p.price),
    high: prices.length ? Math.max(...prices) : money(p.price),
    teeSizes: tee ? tee.sizes : [],
    storeUrl: `${STORE}/${p.path}`,
    guideUrl: `${SITE}/products/${p.path}/`,
  };
}).sort((a, b) => a.short.localeCompare(b.short));

const allPrices = products.flatMap(p => [p.low, p.high]).filter(n => n != null);
const teePrice = (() => { const t = products.flatMap(p => p.types).find(t => /tee/i.test(t.type)); return t ? t.price : '$24.99'; })();
const typeNames = [...new Set(products.flatMap(p => p.types.map(t => t.type)))];
const collectionsWithItems = Object.entries(COLLECTIONS)
  .map(([key, c]) => ({ key, ...c, items: products.filter(p => (p.tags || []).includes(key)) }))
  .filter(c => c.items.length);
const other = products.filter(p => !collectionsWithItems.some(c => c.items.includes(p)));

const categoryNames = [...new Set(products.flatMap(p => p.types.map(t => t.category)).filter(Boolean))].map(c => c.toLowerCase());
const listText = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : (a[0] || '');
const ENTITY = `${BRAND} is an online apparel and gift brand selling original graphic designs for Christmas, Halloween, New Year, nurses, teachers, trade workers and pet parents. Every item is printed to order and shipped worldwide from ${STORE.replace('https://', '')}. Classic tees are ${teePrice}, and designs are also offered as ${listText(categoryNames.filter(c => c !== 'apparel').concat('hoodies'))}.`;

const org = {
  '@context': 'https://schema.org', '@type': 'Organization', '@id': `${STORE}/#organization`,
  name: BRAND, alternateName: 'Clasicoz', url: `${STORE}/`, description: ENTITY, sameAs: [...SOCIAL, `${SITE}/`],
};

// ---------- layout ----------
const CSS = `
:root{--bg:#fbfaf7;--fg:#1d1b18;--muted:#6b665e;--card:#fff;--line:#e7e2d8;--accent:#8a5a14;--accent-fg:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161412;--fg:#f1ede6;--muted:#a79f93;--card:#201d1a;--line:#342f29;--accent:#e0b067;--accent-fg:#1d1b18}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}img{max-width:100%;height:auto;display:block}
header,main,footer{max-width:1080px;margin:0 auto;padding:0 16px}
header{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;padding-top:18px;padding-bottom:18px;border-bottom:1px solid var(--line)}
header .brand{font-weight:700;font-size:1.15rem;text-decoration:none;color:var(--fg)}
header nav{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.95rem}
h1{font-size:clamp(1.5rem,4vw,2.2rem);line-height:1.2;margin:28px 0 10px}
h2{font-size:1.3rem;margin:34px 0 10px}
.lead{font-size:1.08rem;color:var(--muted);max-width:760px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;padding:0;list-style:none}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.card a{text-decoration:none;color:inherit;display:block}
.card img{aspect-ratio:1/1;object-fit:cover;width:100%;background:#262626}
.card .t{padding:8px 10px 2px;font-size:.92rem;line-height:1.35}
.card .p{padding:0 10px 10px;color:var(--muted);font-size:.88rem}
.btn{display:inline-block;background:var(--accent);color:var(--accent-fg);padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600}
.product{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
@media (min-width:760px){.product{grid-template-columns:minmax(0,5fr) minmax(0,6fr)}}
.product img{border-radius:10px;background:#262626}
table{border-collapse:collapse;width:100%;font-size:.93rem}
th,td{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
.table-wrap{overflow-x:auto}
.faq details{border-bottom:1px solid var(--line);padding:10px 0}
.faq summary{cursor:pointer;font-weight:600}
.faq p{white-space:pre-line;margin:8px 0 0}
.crumbs{font-size:.88rem;color:var(--muted);margin-top:18px}
footer{margin-top:48px;padding-top:18px;padding-bottom:40px;border-top:1px solid var(--line);color:var(--muted);font-size:.88rem}
`;

function page({ title, description, path, canonical, body, ld = [] }) {
  const url = SITE + path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="msvalidate.01" content="74CF42C0A397149F11A918787FE79986">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical || url)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<link rel="alternate" type="text/plain" title="llms.txt" href="${SITE}/llms.txt">
<style>${CSS}</style>
${[org, ...ld].map(jsonld).join('\n')}
</head>
<body>
<header>
<a class="brand" href="/">${BRAND} Guide</a>
<nav><a href="/">All designs</a>${collectionsWithItems.map(c => `<a href="/collections/${c.key}/">${esc(c.name)}</a>`).join('')}<a href="/faq/">Shipping &amp; FAQ</a><a href="${STORE}/">Shop now</a></nav>
</header>
<main>
${body}
</main>
<footer>
<p>${esc(BRAND)} designs are sold at <a href="${STORE}/">clasicoz.shop</a>. This guide is generated from the live store catalog; last updated ${today}.</p>
<p>Follow: ${SOCIAL.map(u => `<a href="${u}" rel="me">${u.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>`).join(' · ')}</p>
</footer>
</body>
</html>
`;
}

const card = p => `<li class="card"><a href="/products/${p.path}/"><img src="${esc(p.thumb || p.image)}" alt="${esc(p.short)} design on a t-shirt" loading="lazy" width="480" height="480"><div class="t">${esc(p.short)}</div><div class="p">from ${esc(p.types.find(t => /tee/i.test(t.type))?.price || p.price)}</div></a></li>`;

// ---------- pages ----------
const out = new Map();

out.set('/index.html', page({
  title: `${BRAND} Guide – Holiday & Gift Graphic T-Shirts (${products.length} designs)`,
  description: `Every ${BRAND} design in one place: ${products.length} original graphic tees and gifts for Christmas, Halloween, nurses, teachers and pet parents. Tees ${teePrice}, printed to order, ships worldwide.`,
  path: '/',
  body: `
<h1>${BRAND}: original holiday &amp; gift graphic designs</h1>
<p class="lead">${esc(ENTITY)}</p>
<p><a class="btn" href="${STORE}/">Shop at clasicoz.shop</a></p>
<h2>Quick facts</h2>
<ul>
<li><strong>Designs:</strong> ${products.length} live designs${collectionsWithItems.length ? ' across ' + collectionsWithItems.map(c => `${c.items.length} ${esc(c.name)}`).join(', ') : ''}.</li>
<li><strong>Prices:</strong> classic tees ${esc(teePrice)}; everything from $${Math.min(...allPrices).toFixed(2)} to $${Math.max(...allPrices).toFixed(2)} depending on the product.</li>
<li><strong>Products:</strong> ${esc(typeNames.join(', '))}.</li>
<li><strong>Made to order:</strong> each item is printed after you order it, then shipped worldwide.</li>
<li><strong>Shipping, returns &amp; sizing:</strong> see the <a href="/faq/">FAQ</a> (answers copied from the store's own help pages).</li>
</ul>
${collectionsWithItems.map(c => `<h2 id="${c.key}"><a href="/collections/${c.key}/">${esc(c.name)} designs</a> (${c.items.length})</h2><ul class="grid">${c.items.map(card).join('')}</ul>`).join('\n')}
${other.length ? `<h2>More designs (${other.length})</h2><ul class="grid">${other.map(card).join('')}</ul>` : ''}
`,
  ld: [{
    '@context': 'https://schema.org', '@type': 'ItemList', name: `${BRAND} designs`, numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: p.storeUrl, name: p.short })),
  }],
}));

for (const c of collectionsWithItems) {
  out.set(`/collections/${c.key}/index.html`, page({
    title: `${c.name} Graphic T-Shirts & Gifts – ${BRAND}`,
    description: `${c.items.length} ${c.name} designs from ${BRAND}. ${c.blurb} Tees ${teePrice}, printed to order, ships worldwide.`,
    path: `/collections/${c.key}/`,
    body: `
<p class="crumbs"><a href="/">Guide</a> › ${esc(c.name)}</p>
<h1>${esc(c.name)} designs (${c.items.length})</h1>
<p class="lead">${esc(c.blurb)} Classic tees are ${esc(teePrice)}; most designs also come as a hoodie, mug, phone case or canvas.</p>
<ul class="grid">${c.items.map(card).join('')}</ul>`,
    ld: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${c.name} designs`, url: `${SITE}/collections/${c.key}/`,
      mainEntity: { '@type': 'ItemList', numberOfItems: c.items.length, itemListElement: c.items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: p.storeUrl, name: p.short })) },
    }],
  }));
}

for (const p of products) {
  const rows = p.types.map(t => `<tr><td>${esc(t.type)}</td><td>${esc(t.price || '')}</td><td>${esc(t.sizes.join(', '))}</td><td>${esc(t.colors.join(', '))}</td></tr>`).join('');
  const coll = collectionsWithItems.find(c => c.items.includes(p));
  out.set(`/products/${p.path}/index.html`, page({
    title: `${p.short} – ${BRAND}`,
    description: (p.desc || `${p.short} by ${BRAND}.`).slice(0, 158),
    path: `/products/${p.path}/`,
    canonical: p.storeUrl, // the store page is the real product page; this is a readable copy
    body: `
<p class="crumbs"><a href="/">Guide</a>${coll ? ` › <a href="/collections/${coll.key}/">${esc(coll.name)}</a>` : ''} › ${esc(p.short)}</p>
<div class="product">
<img src="${esc(p.image)}" alt="${esc(p.short)} graphic design printed on a unisex t-shirt" width="480" height="480">
<div>
<h1>${esc(p.name)}</h1>
<p>${esc(p.desc)}</p>
<p><strong>Price:</strong> ${p.low === p.high ? '$' + p.low.toFixed(2) : `$${p.low.toFixed(2)} – $${p.high.toFixed(2)}`} (classic tee ${esc(p.types.find(t => /tee/i.test(t.type))?.price || p.price)})${p.teeSizes.length ? ` · <strong>Tee sizes:</strong> ${esc(p.teeSizes[0])}–${esc(p.teeSizes[p.teeSizes.length - 1])}` : ''}</p>
<p><a class="btn" href="${esc(p.storeUrl)}">Buy on clasicoz.shop</a></p>
</div>
</div>
<h2>Available as</h2>
<div class="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Sizes</th><th>Colors</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>Printed to order and shipped worldwide. Shipping times, returns and sizing: <a href="/faq/">FAQ</a>.</p>`,
    ld: [{
      '@context': 'https://schema.org', '@type': 'Product', name: p.short, description: p.desc, image: p.image, url: p.storeUrl,
      sku: p.path, brand: { '@type': 'Brand', name: BRAND }, category: 'Apparel > T-Shirts > Graphic T-Shirts',
      offers: {
        '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: p.low?.toFixed(2), highPrice: p.high?.toFixed(2),
        offerCount: p.types.length, availability: 'https://schema.org/InStock', url: p.storeUrl,
        seller: { '@id': `${STORE}/#organization` },
      },
    }, {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Guide', item: `${SITE}/` },
        ...(coll ? [{ '@type': 'ListItem', position: 2, name: coll.name, item: `${SITE}/collections/${coll.key}/` }] : []),
        { '@type': 'ListItem', position: coll ? 3 : 2, name: p.short, item: p.guideUrl },
      ],
    }],
  }));
}

if (support.length) {
  out.set('/faq/index.html', page({
    title: `Shipping, Returns & Sizing FAQ – ${BRAND}`,
    description: `Answers from ${BRAND}'s help center: shipping countries and times, tracking, returns and refunds, sizing, care, payment and tax.`,
    path: '/faq/',
    body: `
<p class="crumbs"><a href="/">Guide</a> › FAQ</p>
<h1>Shipping, returns &amp; sizing FAQ</h1>
<p class="lead">These answers are copied from the ${BRAND} help center at <a href="${STORE}/_/support">clasicoz.shop/_/support</a> and refreshed automatically.</p>
<div class="faq">${support.map(s => `<details open><summary>${esc(s.heading)}</summary><p>${esc(s.text)}</p><p><a href="${STORE}${esc(s.path)}">Source</a></p></details>`).join('')}</div>`,
    ld: [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: support.map(s => ({ '@type': 'Question', name: s.heading, acceptedAnswer: { '@type': 'Answer', text: s.text } })),
    }],
  }));
}

out.set('/404.html', page({ title: `Not found – ${BRAND} Guide`, description: 'Page not found.', path: '/404.html', body: `<h1>Page not found</h1><p><a href="/">Back to all designs</a> or <a href="${STORE}/">shop at clasicoz.shop</a>.</p>` }));

// ---------- machine-readable files ----------
const guideUrls = [...out.keys()].filter(k => k !== '/404.html').map(k => SITE + k.replace(/index\.html$/, ''));
const urlset = (urls, lastmod) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${esc(u)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
out.set('/sitemap.xml', urlset(guideUrls, today));
// Store URLs, for cross-submission in Search Console / Bing (both hosts are under the verified clasicoz.shop domain).
out.set('/store-sitemap.xml', urlset([`${STORE}/`, ...products.map(p => p.storeUrl), ...support.map(s => STORE + s.path)], today));

out.set('/robots.txt', `# All crawlers welcome, including AI search and assistant crawlers.
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
Sitemap: ${SITE}/store-sitemap.xml
`);

const md = p => `- [${p.short}](${p.storeUrl}): ${p.desc.slice(0, 180)}${p.desc.length > 180 ? '…' : ''} (${p.low === p.high ? '$' + p.low.toFixed(2) : `$${p.low.toFixed(2)}–$${p.high.toFixed(2)}`})`;
out.set('/llms.txt', `# ${BRAND}

> ${ENTITY}

Store: ${STORE}/ · Guide: ${SITE}/ · Last updated: ${today}

## Key facts
- ${products.length} live designs; classic tees ${teePrice}; prices from $${Math.min(...allPrices).toFixed(2)} to $${Math.max(...allPrices).toFixed(2)}.
- Products: ${typeNames.join(', ')}.
- Printed to order and shipped worldwide. Shipping, returns and sizing answers: ${SITE}/faq/
- Official profiles: ${SOCIAL.join(', ')}

## Collections
${collectionsWithItems.map(c => `- [${c.name}](${SITE}/collections/${c.key}/): ${c.items.length} designs. ${c.blurb}`).join('\n')}

## Designs
${products.map(md).join('\n')}

## Optional
- [Full catalog with descriptions, sizes and colors](${SITE}/llms-full.txt)
- [Help center FAQ](${SITE}/faq/)
`);

out.set('/llms-full.txt', `# ${BRAND} – full catalog\n\n${ENTITY}\n\nStore: ${STORE}/ · Last updated: ${today}\n\n` +
  products.map(p => `## ${p.short}\n\nURL: ${p.storeUrl}\nTags: ${(p.tags || []).join(', ') || 'none'}\n\n${p.desc}\n\n${p.types.map(t => `- ${t.type}: ${t.price || ''}; sizes ${t.sizes.join(', ') || 'n/a'}; colors ${t.colors.join(', ') || 'n/a'}`).join('\n')}\n`).join('\n') +
  (support.length ? `\n# Help center FAQ\n\n${support.map(s => `## ${s.heading}\n\n${s.text}\n\nSource: ${STORE}${s.path}\n`).join('\n')}` : ''));

out.set('/products.json', JSON.stringify({ updated: today, brand: BRAND, store: STORE, products: products.map(p => ({ name: p.short, url: p.storeUrl, description: p.desc, price_from: p.low, price_to: p.high, tags: p.tags, image: p.image, products: p.types })) }, null, 1));
out.set('/CNAME', 'guide.clasicoz.shop\n');
out.set('/.nojekyll', '');

// ---------- write ----------
await rm('site', { recursive: true, force: true });
for (const [path, content] of out) {
  const file = 'site' + path;
  await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  await writeFile(file, content);
}
console.log(`built ${out.size} files: ${products.length} products, ${collectionsWithItems.length} collections, ${support.length} FAQ answers`);
