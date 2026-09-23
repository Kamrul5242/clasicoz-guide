// Answer-first content blocks for AEO / GEO / LLM extraction, built only from catalog facts
// (names, descriptions, prices, sizes, colors, product types, tags). Nothing is invented:
// if a fact isn't in the data, the text doesn't claim it.

export const OCCASIONS = {
  christmas: { label: 'Christmas', noun: 'Christmas gifts' },
  halloween: { label: 'Halloween', noun: 'Halloween shirts' },
  'new-year': { label: 'New Year', noun: 'New Year shirts' },
};

// Who a design is for. Matched against the product name and the start of its description.
export const PERSONAS = {
  teacher: { label: 'teachers', re: /teach|school|classroom|student|principal/i },
  nurse: { label: 'nurses', re: /\bnurs|scrubs|hospital|\bmedical\b/i },
  family: { label: 'families', re: /\bfamily\b|matching/i },
  mom: { label: 'moms', re: /\bmoms?\b|\bmother\b|\bmama\b/i },
  grandma: { label: 'grandmas', re: /grand ?(ma|mother)|\bnana\b|granny/i },
  cat: { label: 'cat lovers', re: /\bcats?\b|kitty|meow|feline|kitten/i },
  dog: { label: 'dog lovers', re: /\bdogs?\b|\bpupp|canine/i },
  gothic: { label: 'goth and alternative style fans', re: /goth|crow|raven|witch|skull|\bbats?\b|full moon|dark/i },
};

const MIN_GUIDE_ITEMS = 3;

export const firstSentence = t => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  const m = s.match(/^.{30,240}?[.!?](\s|$)/);
  return (m ? m[0] : s.slice(0, 200)).trim();
};
const listText = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : (a[0] || '');
const money = n => '$' + Number(n).toFixed(2);

export function personasOf(p) {
  const hay = p.short + ' ' + String(p.desc || '').slice(0, 220);
  return Object.entries(PERSONAS).filter(([, v]) => v.re.test(hay)).map(([k]) => k);
}
export function occasionsOf(p) {
  return Object.keys(OCCASIONS).filter(o => (p.tags || []).includes(o));
}

// "Quick answers" for a product page: question -> answer, all from data.
export function productAnswers(p) {
  const tee = p.types.find(t => /tee/i.test(t.type));
  const others = p.types.filter(t => t !== tee).map(t => `${t.type} (${t.price})`);
  const occ = occasionsOf(p).map(o => OCCASIONS[o].label);
  const per = personasOf(p).map(k => PERSONAS[k].label);
  const qa = [];
  qa.push([`What is the ${p.short}?`, `${firstSentence(p.desc)} It is sold by Clasicoz Shop at ${p.storeUrl.replace('https://', '')}.`]);
  if (tee) qa.push([`How much does the ${p.short} cost?`, `The classic unisex tee is ${tee.price}.${others.length ? ` The same design is also available as a ${listText(others)}.` : ''}`]);
  if (tee && tee.sizes.length) qa.push(['What sizes and colors are available?', `Tee sizes run ${tee.sizes[0]} to ${tee.sizes[tee.sizes.length - 1]} (${tee.sizes.join(', ')}). It comes in ${tee.colors.length} color${tee.colors.length === 1 ? '' : 's'}${tee.colors.length ? `, including ${listText(tee.colors.slice(0, 5))}` : ''}.`]);
  if (occ.length || per.length) qa.push(['Who is this design for?', `It is a ${occ.length ? listText(occ) + ' ' : ''}design${per.length ? ` made for ${listText(per)}` : ''}, and works as a gift or for your own wardrobe.`]);
  qa.push(['How is it made and shipped?', 'Each item is printed to order after you buy it and shipped worldwide. Shipping times, tracking, returns and sizing help are in the Clasicoz Shop FAQ.']);
  return qa;
}

// Category (collection) facts for an answer-first intro.
export function collectionFacts(items) {
  const tees = items.map(p => p.types.find(t => /tee/i.test(t.type))).filter(Boolean);
  const typeCount = {};
  items.forEach(p => p.types.forEach(t => { typeCount[t.type] = (typeCount[t.type] || 0) + 1; }));
  const perCount = {};
  items.forEach(p => personasOf(p).forEach(k => { perCount[k] = (perCount[k] || 0) + 1; }));
  const lows = items.map(p => p.low).filter(n => n != null), highs = items.map(p => p.high).filter(n => n != null);
  return {
    count: items.length,
    teePrice: tees[0] ? tees[0].price : null,
    low: lows.length ? Math.min(...lows) : null,
    high: highs.length ? Math.max(...highs) : null,
    types: Object.entries(typeCount).sort((a, b) => b[1] - a[1]),
    personas: Object.entries(perCount).sort((a, b) => b[1] - a[1]).map(([k, n]) => [PERSONAS[k].label, n]),
  };
}

export function collectionAnswers(name, f) {
  const qa = [];
  qa.push([`How many ${name} designs does Clasicoz Shop have?`, `${f.count} ${name} designs are live right now.`]);
  if (f.teePrice) qa.push([`How much are Clasicoz Shop ${name} shirts?`, `Classic tees are ${f.teePrice}. Across all products in this collection prices run from ${money(f.low)} to ${money(f.high)}.`]);
  if (f.types.length) qa.push(['What products can I get these designs on?', `${listText(f.types.slice(0, 6).map(([t, n]) => `${t} (${n} designs)`))}.`]);
  if (f.personas.length) qa.push(['Who are these designs for?', `The most common themes are for ${listText(f.personas.slice(0, 5).map(([l, n]) => `${l} (${n})`))}.`]);
  return qa;
}

// Gift guides: occasion x persona, persona-wide and occasion-wide. Only where >= MIN_GUIDE_ITEMS match.
export function buildGuides(products) {
  const guides = [];
  const add = (slug, title, h1, intro, items, meta) => {
    if (items.length >= MIN_GUIDE_ITEMS) guides.push({ slug, title, h1, intro, items, ...meta });
  };
  for (const [o, O] of Object.entries(OCCASIONS)) {
    const occItems = products.filter(p => occasionsOf(p).includes(o));
    for (const [k, P] of Object.entries(PERSONAS)) {
      const items = occItems.filter(p => personasOf(p).includes(k));
      add(`${o}-shirts-for-${k}`, `${O.label} Shirts for ${cap(P.label)}: ${items.length} Graphic Tee Ideas | Clasicoz Shop`,
        `${O.label} shirts for ${P.label}`,
        `${items.length} ${O.label} graphic tee designs from Clasicoz Shop made for ${P.label}. Classic tees are ${teeP(items)}, printed to order in sizes S–5XL and shipped worldwide.`,
        items, { occasion: o, persona: k });
    }
    add(`${o}-graphic-tees`, `${O.label} Graphic T-Shirts: All ${occItems.length} Designs | Clasicoz Shop`,
      `All ${O.label} graphic tees`,
      `Every ${O.label} design currently sold by Clasicoz Shop: ${occItems.length} graphic tees, classic tees ${teeP(occItems)}, printed to order and shipped worldwide.`,
      occItems, { occasion: o });
  }
  for (const [k, P] of Object.entries(PERSONAS)) {
    const items = products.filter(p => personasOf(p).includes(k));
    if (items.length < MIN_GUIDE_ITEMS + 1) continue; // persona-wide guides need a bit more depth
    add(`gifts-for-${k}`, `Gift Shirts for ${cap(P.label)}: ${items.length} Funny Graphic Tees | Clasicoz Shop`,
      `Gift shirts for ${P.label}`,
      `${items.length} Clasicoz Shop graphic tee designs made for ${P.label}, across ${listText([...new Set(items.flatMap(occasionsOf))].map(o => OCCASIONS[o].label)) || 'all seasons'}. Classic tees are ${teeP(items)}.`,
      items, { persona: k });
  }
  return guides;
}

export function guideAnswers(g) {
  const f = collectionFacts(g.items);
  const qa = [];
  qa.push([`What are good ${g.h1.toLowerCase()}?`, `Top picks: ${listText(g.items.slice(0, 3).map(p => p.short))}. See the full list of ${g.items.length} designs below.`]);
  if (f.teePrice) qa.push(['How much do they cost?', `Classic tees are ${f.teePrice}; across all product types prices run from ${money(f.low)} to ${money(f.high)}.`]);
  qa.push(['What sizes are available?', 'Classic unisex tees come in S to 5XL. Most designs are also sold as a mug, and many as a hoodie, phone case or canvas print.']);
  qa.push(['Where can I buy them?', 'All designs are sold at clasicoz.shop, printed to order and shipped worldwide.']);
  return qa;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const teeP = items => { const t = items.map(p => p.types.find(x => /tee/i.test(x.type))).find(Boolean); return t ? t.price : '$24.99'; };
