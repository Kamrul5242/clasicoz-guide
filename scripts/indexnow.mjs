// Pings IndexNow (Bing, Yandex, Seznam, Naver...) with every URL in the guide sitemap.
// Runs after deploy; the key file is published by build.mjs at /<key>.txt.
import { readFile } from 'node:fs/promises';

const HOST = 'guide.clasicoz.shop';
const build = await readFile('scripts/build.mjs', 'utf8');
const key = (build.match(/INDEXNOW_KEY = '([0-9a-f]{32})'/) || [])[1];
if (!key) { console.error('no IndexNow key found'); process.exit(1); }
const xml = await readFile('site/sitemap.xml', 'utf8');
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList }),
});
console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} URLs`);
// 200/202 = accepted. Anything else is logged but doesn't fail the deploy.
