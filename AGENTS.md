# Instructions for AI agents working on this repo

- This is a static HTML/CSS site. No frameworks, no build step. Keep it that way unless the owner asks.
- Design: warm off-white background (#faf9f6), serif display + clean sans body, generous whitespace. Reuse classes from `styles.css`; do not add inline styles or new CSS files.
- Every page must keep in `<head>`: description, canonical, og:*, twitter:*, and `<script src="analytics.js" defer>` (with `../` from `writing/`).
- New essay: follow README → "Add a new essay". Update `index.html` and `sitemap.xml` in the same commit.
- Language on the site: English. Owner communicates in Russian.
- Never commit secrets, API keys or personal data. Never remove the "Not investment advice" footer.
- Check mobile (375px) and desktop before pushing to `main`; `main` deploys to production.
