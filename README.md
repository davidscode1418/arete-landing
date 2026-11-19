# Arete landing page (areteprograms.net)

The coming soon page for Arete, with its waiting list. Separate from the
Arete app: own repository, own Cloudflare Pages project, own storage.

## What's where

- `public/` the page itself: `index.html`, `styles.css`, `main.js`,
  `admin.html` (the list, behind a password), `privacy.html`, `404.html`,
  `assets/`, and `_headers` (security and cache headers).
- `functions/api/waitlist/[[path]].js` the backend, a Cloudflare Pages
  Function at `/api/waitlist`.
- `lib/waitlist.mjs` the waiting list rules: 100 early access spots in sign
  up order, one place per email, the leave link, the confirmation email.
- `lib/d1store.mjs` where sign ups are kept: a D1 (SQLite) database.
- `tests/` `npm test` runs the rules against an in-memory store.

## Run it locally

```
npm install
npm test
npm run dev        # http://localhost:8888, admin password "local admin"
```

## Cloudflare Pages settings

- Build command: none. Build output directory: `public`. Root: the repo.
- Settings > Bindings: D1 database, variable name `DB` (database
  `arete-waitlist`, location Western Europe).
- Settings > Variables and secrets: `ADMIN_PASSWORD` (secret),
  `SITE_URL` = `https://areteprograms.net`, and for the confirmation email
  `RESEND_API_KEY` (secret) and `EMAIL_FROM` = `Arete <hello@areteprograms.net>`.
- Custom domain: `areteprograms.net`.

The table is created by itself on the first request.
