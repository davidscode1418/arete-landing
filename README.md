# Arete landing page (areteprograms.net)

The coming soon page for Arete, with its waiting list. Separate from the
Arete app: own repository, own Cloudflare Worker, own storage.

## What's where

- `public/` the page itself: `index.html`, `styles.css`, `main.js`,
  `admin.html` (the list, behind a password), `privacy.html`, `404.html`,
  `assets/`, and `_headers` (security and cache headers).
- `src/worker.js` the Cloudflare Worker: `/api/waitlist` goes to
  `src/waitlist-api.js` (the backend), everything else is served from
  `public/`.
- `wrangler.jsonc` Cloudflare's settings: the name, `public/`, the D1
  database, `SITE_URL`.
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

## Cloudflare settings

Cloudflare (Workers & Pages > arete-landing) builds and deploys on every
push to main, using `wrangler.jsonc`: build command none, deploy command
`npx wrangler deploy`.

In Settings > Variables and secrets: `ADMIN_PASSWORD` (secret), and for
the confirmation email `RESEND_API_KEY` (secret) and `EMAIL_FROM` =
`Arete <hello@areteprograms.net>`. Custom domain: `areteprograms.net`.

The D1 database is `arete-waitlist` (Western Europe). Its table is created
by itself on the first request.
