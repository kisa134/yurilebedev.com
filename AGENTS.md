# Instructions for AI agents working on this repo

- This is a static HTML/CSS site. No frameworks, no build step. Keep it that way unless the owner asks.
- Design system: elayadesign `landing-page-design` skill (github.com/elayadesign/ai-design-skills). Dark flat surfaces from the approved palette only (#181818 base, #1F1F1F and #272727 surfaces, #313131 lines), one accent (#A3B899), one typeface: Geist, self-hosted in `fonts/` (Geist Mono only for labels and numbers). No italics, no weights above bold, no background gradients (gradient only on the home hero heading text).
- Every size, space, radius and duration is a token in `:root` of `styles.css`. Use the tokens; never add ad hoc values, inline styles or new CSS files. Motion: `--ease` curve, 500ms movement, 300ms colour, IntersectionObserver only (`site.js`).
- Copy rules: sentence case, no hyphens in interface copy, no orphaned words (`text-wrap: balance/pretty`). Essay prose is the owner's text: do not rewrite it.
- Primary action on every page: Follow on X (@Cogit08).
- Every page must keep in `<head>`: description, canonical, og:* (incl. og:image = /og.png), twitter:* (summary_large_image), favicon links, the inline `js` class script, `analytics.js` and `site.js` (with `../` from `writing/`; absolute `/` paths in `404.html`). Essays also keep their Article JSON-LD.
- New essay: follow README → "Add a new essay". Update `index.html` and `sitemap.xml` in the same commit.
- Language on the site: English. Owner communicates in Russian.
- Never commit secrets, API keys or personal data. Never remove the "Not investment advice" footer.
- Check mobile (375px) and desktop before pushing to `main`; `main` deploys to production.
