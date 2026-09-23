# guide.clasicoz.shop

A plain-HTML guide to the [Clasicoz Shop](https://clasicoz.shop) catalog that search engines and AI
crawlers (GPTBot, PerplexityBot, ClaudeBot, OAI-SearchBot…) can read without running JavaScript.
The store itself sits behind a JavaScript challenge those crawlers can't pass.

## How it updates

`.github/workflows/build.yml` runs twice a day (and on every push or manual run):

1. `scripts/fetch.mjs` opens the store in headless Chrome, reads the full catalog from the store's
   own API, the product details embedded in each product page, and the help-center answers, and
   writes `data/products.json` and `data/support.json`. New products appear automatically.
2. `scripts/build.mjs` turns that data into the static site in `site/`: home, collections, one page
   per product (canonical points to the store page), FAQ, `llms.txt`, `llms-full.txt`,
   `sitemap.xml`, `store-sitemap.xml`, `robots.txt`.
3. The site is deployed to GitHub Pages at `guide.clasicoz.shop`.

If a fetch fails or returns a suspiciously small catalog, the last good data is kept.

## Run locally

```
npm ci
CHROME_PATH="C:/Program Files/Google/Chrome Beta/Application/chrome.exe" node scripts/fetch.mjs
node scripts/build.mjs
```
