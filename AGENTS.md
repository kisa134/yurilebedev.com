# Instructions for AI agents working on this repo

- This is a static HTML/CSS site. No frameworks, no build step. Keep it that way unless the owner asks.
- Home page is Bentlik OS: a personal operating system. Boot screen, a live 1-bit dithered night island (WebGL raymarch + Bayer dither) with Bentlik's lighthouse, draggable windows (About, Notebook, Weather, Dogs, Games, bentlik). Palette: ink #0D0E0B, paper #CFCBBE, one green #00A651. Everything Yuri adds (photos, scans, drawings) goes through the same dither. The weather is live 1-minute BTC moves from the public Hyperliquid API, shown only as weather, never as prices. Bentlik's lighthouse never goes dark.
- Essay pages are the reading mode of the notebook (dark, Newsreader + JetBrains Mono, tokens in `styles.css`).
- To fill a plate: put the scan in `art/`, replace `.plate-empty` with `<img src="art/<file>" alt="...">`. Ink drawings vectorised to SVG paths with `data-draw` will draw themselves on scroll.
- Essay prose is the owner's text: do not rewrite it.
- Every page must keep in `<head>`: description, canonical, og:* (og:image = /og.png), twitter:* (summary_large_image), favicon links, the inline `js` class script, `analytics.js` and `site.js` (with `../` from `writing/`; absolute `/` paths in `404.html`). Essays also keep their Article JSON-LD.
- Primary action everywhere: Follow on X (@Cogit08).
- New essay: follow README → "Add a new essay". Update `index.html` and `sitemap.xml` in the same commit.
- Language on the site: English. Owner communicates in Russian.
- Never commit secrets, API keys or personal data. Never remove the "Not investment advice" footer.
- Check mobile (375px) and desktop before pushing to `main`; `main` deploys to production.
