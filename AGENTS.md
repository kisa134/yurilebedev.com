# Instructions for AI agents working on this repo

- This is a static HTML/CSS site. No frameworks, no build step. Keep it that way unless the owner asks.
- Design: a notebook. Two halves. The system: paper (#F3EFE6) with a dot grid, ink (#1D1C1A), one accent (the red pencil #B4472F), Newsreader for text and JetBrains Mono for every number, label and date, a margin column with § numbers, figures drawn by code. The hand: Yuri's own drawings (ink, pencil, watercolour) placed in `figure.plate` slots as scans. Never imitate handwriting or hand drawing in code; empty plates stay as honest proofs (crop marks, "to be drawn").
- Every size, space and duration is a token in `:root` of `styles.css` (Tailwind type scale and spacing). Reuse classes; no inline styles, no new CSS files. Motion lives in `site.js`: IntersectionObserver reveals, `path[data-draw]` inside `[data-draw-root]` draws itself, one rAF-throttled scroll handler for the ribbon.
- Seismograph (`seismo.js`): one number, the weather, drives the page. Live 1-minute BTC moves from the public Hyperliquid API when it answers, otherwise a resting simulation. Never show prices or tickers; the link to the market stays a metaphor. Cubs (ASCII) are the crowd; Badrik (light, mad) and Sonechka (dark, calm) bring them home; Bentlik sits on the zero line, never moves and never glitches. Accent colour is the green marker (`--green`, `--green-ink` for text).
- To fill a plate: put the scan in `art/`, replace `.plate-empty` with `<img src="art/<file>" alt="...">`. Ink drawings vectorised to SVG paths with `data-draw` will draw themselves on scroll.
- Essay prose is the owner's text: do not rewrite it.
- Every page must keep in `<head>`: description, canonical, og:* (og:image = /og.png), twitter:* (summary_large_image), favicon links, the inline `js` class script, `analytics.js` and `site.js` (with `../` from `writing/`; absolute `/` paths in `404.html`). Essays also keep their Article JSON-LD.
- Primary action everywhere: Follow on X (@Cogit08).
- New essay: follow README → "Add a new essay". Update `index.html` and `sitemap.xml` in the same commit.
- Language on the site: English. Owner communicates in Russian.
- Never commit secrets, API keys or personal data. Never remove the "Not investment advice" footer.
- Check mobile (375px) and desktop before pushing to `main`; `main` deploys to production.
