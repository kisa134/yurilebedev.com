# yurilebedev.com — Cogito

Personal site and journal of Yuri (Cogito, X: [@Cogit08](https://x.com/Cogit08)): trading, building tools, systems thinking.

Static site, no build step. Hosted on GitHub Pages, domain `yurilebedev.com` (DNS at GoDaddy).

## Structure

```
index.html                      Home: hero, writing list, projects, about
styles.css                      All styles (one file)
analytics.js                    GA4 + first-touch attribution + reading events
writing/point-zero.html         Essay 001
writing/building-in-public.html Essay 002
sitemap.xml, robots.txt         SEO
CNAME                           Custom domain for GitHub Pages
```

## Add a new essay

1. Copy `writing/point-zero.html` to `writing/<slug>.html`, keep the `<head>` block (canonical, og, analytics) and update title, description, canonical, og:url.
2. Add an `essay-row` link in `index.html` → `#writing`, next number (ESSAY 003…).
3. Add the URL to `sitemap.xml`.
4. Commit and push to `main` — GitHub Pages deploys automatically.

## Analytics

- Google Analytics 4 property: `yurilebedev.com` (account "cogito"). The Measurement ID lives only in `analytics.js` (`GA_ID`).
- Events: `page_view`, `select_essay`, `outbound_click`, `essay_progress` (25/50/75/100), `essay_read` (≥75% and ≥60 s).
- User properties (first touch): `first_source`, `first_medium`, `first_campaign`, `first_landing`.

### UTM links — always use them when sharing

| Where | Link |
|---|---|
| X post | `https://yurilebedev.com/writing/<slug>.html?utm_source=x&utm_medium=social&utm_campaign=<slug>` |
| X bio | `https://yurilebedev.com/?utm_source=x&utm_medium=bio` |
| Telegram | `...?utm_source=telegram&utm_medium=social&utm_campaign=<slug>` |
| LinkedIn | `...?utm_source=linkedin&utm_medium=social&utm_campaign=<slug>` |
| Email / DM | `...?utm_source=dm&utm_medium=direct&utm_campaign=<slug>` |

## Rules

- English only. Public name: Cogito / Yuri. No surname in page text.
- Not investment advice: keep the footer disclaimer on every page.
- No secrets in this repo — it is public.
