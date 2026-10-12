# Clasicoz monitor — 2026-10-12

**0 failing, 3 warnings, 30 ok, 3 skipped, 4 info.**

## DNS

| | Check | Detail |
|---|---|---|
| ✅ | Nameservers are Cloudflare only | adi.ns.cloudflare.com, lennon.ns.cloudflare.com |
| ✅ | MX records present | 70 route3.mx.cloudflare.net, 21 route1.mx.cloudflare.net, 30 route2.mx.cloudflare.net |
| ✅ | SPF record | v=spf1 include:_spf.mx.cloudflare.net ~all |
| ✅ | DMARC record | v=DMARC1; p=none; rua=mailto:540a78554e814ecf88fd4b49a93b3c3b@dmarc-reports.cloudflare.net |
| ✅ | guide CNAME -> GitHub Pages (DNS only) | kamrul5242.github.io |

## HTTPS

| | Check | Detail |
|---|---|---|
| ✅ | Valid certificate: clasicoz.shop | HTTP 200 |
| ✅ | Valid certificate: www.clasicoz.shop | HTTP 200 |
| ✅ | Valid certificate: guide.clasicoz.shop | HTTP 200 |

## Guide

| | Check | Detail |
|---|---|---|
| ✅ | llms.txt lists every live product | 81 products |
| ✅ | /sitemap.xml reachable | HTTP 200 |
| ✅ | /store-sitemap.xml reachable | HTTP 200 |
| ✅ | /robots.txt reachable | HTTP 200 |
| ✅ | /logo.png reachable | HTTP 200 |
| ✅ | /guides/ reachable | HTTP 200 |

## AI crawlers

| | Check | Detail |
|---|---|---|
| ✅ | GPTBot can read guide | HTTP 200, 66990 bytes |
| ℹ️ | GPTBot on store | 531 bytes (GearLaunch challenge page, known platform limit; the guide covers this) |
| ✅ | OAI-SearchBot can read guide | HTTP 200, 66990 bytes |
| ℹ️ | OAI-SearchBot on store | 506 bytes (GearLaunch challenge page, known platform limit; the guide covers this) |
| ✅ | PerplexityBot can read guide | HTTP 200, 66990 bytes |
| ℹ️ | PerplexityBot on store | 572 bytes (GearLaunch challenge page, known platform limit; the guide covers this) |
| ✅ | ClaudeBot can read guide | HTTP 200, 66990 bytes |
| ℹ️ | ClaudeBot on store | 550 bytes (GearLaunch challenge page, known platform limit; the guide covers this) |

## Store SEO

| | Check | Detail |
|---|---|---|
| ✅ | Rendered / | title 53ch, desc 160ch, H1 x1, canonical yes, schema Organization/WebSite |
| ✅ | Rendered /gathering-of-crows-tee | title 50ch, desc 160ch, H1 x1, canonical yes, schema Organization/WebSite/Product/BreadcrumbList |
| ✅ | Rendered /_/support | title 55ch, desc 147ch, H1 x1, canonical yes, schema Organization/WebSite |

## Entity

| | Check | Detail |
|---|---|---|
| ✅ | Brand name identical (store vs guide) | Clasicoz Shop / Clasicoz Shop |
| ✅ | Logo identical | https://guide.clasicoz.shop/logo.png |
| ✅ | Social profiles (sameAs) identical | 3 on store |
| ✅ | Disambiguation statement present |  |
| ✅ | Profile reachable: www.tiktok.com | HTTP 200 |
| ⚠️ | Profile reachable: www.instagram.com | HTTP 429 |
| ✅ | Profile reachable: www.facebook.com | HTTP 200 |

## Catalog

| | Check | Detail |
|---|---|---|
| ✅ | Live products | 81 (added 0, removed 0) |
| ✅ | No "Keywords:" spam in descriptions |  |

## Gaps

| | Check | Detail |
|---|---|---|
| ⚠️ | Descriptions under 200 characters | woodland-christmas-winter-cheer-tee, winter-wolf-christmas-moon-tee, winter-king-christmas-tee, spooky-season-gathering-tee, christmas-veterinarian-paws-holiday-cheer-tee, october-club-tee, night-scholar-owl-tee, moonlit-wings-autumn-after-dark-tee |
| ✅ | FAQ covers core buyer questions | 7 topics |
| ⚠️ | Collections with fewer than 5 designs (content/design gap) | new-year (2) |

## Search

| | Check | Detail |
|---|---|---|
| ⏭️ | Brand SERP, competitors, reputation | add repo secret BRAVE_API_KEY (free tier: api.search.brave.com) |

## AI answers

| | Check | Detail |
|---|---|---|
| ⏭️ | AI citation checks (Perplexity) | add repo secret PERPLEXITY_API_KEY (paid, a few cents per run) |

## Bing

| | Check | Detail |
|---|---|---|
| ⏭️ | Bing query stats | add repo secret BING_WEBMASTER_API_KEY (Bing Webmaster > Settings > API access) |

