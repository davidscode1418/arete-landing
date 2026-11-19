# Arete landing page (areteprograms.net)

The coming soon page for Arete, with its waiting list. This is its own
project: its own repository, its own Cloudflare Pages project, its own backend and
storage. It promotes the Arete app (areteprograms.com) but shares no code,
server or database with it. Never change the app from here.

## How it's built

- `public/`: the page. Plain files, no build: `index.html`, `styles.css`,
  `main.js` (setting at the top: `VIDEO_ID`), `admin.html` (the list,
  behind `ADMIN_PASSWORD`), `privacy.html`, `404.html`, `_headers`.
- `functions/api/waitlist/[[path]].js`: the backend (`/api/waitlist`), a
  Cloudflare Pages Function.
- `lib/waitlist.mjs`: the waiting list rules (100 early access spots, sign
  up order, one place per email, the leave link, the welcome email). Web
  Crypto only, no Node modules.
- `lib/d1store.mjs`: storage, a D1 database bound as `DB`.

## Commands

- `npm install` once.
- `npm test` runs the waiting list tests.
- `npm run dev` runs the page and backend on Cloudflare's local runtime at
  http://localhost:8888 (admin password "local admin").

## Rules

- The look follows the Arete app's "Serif voice" design: dark by default,
  light on request, IBM Plex Sans Condensed, JetBrains Mono, Fraunces, one
  lime accent.
- Copy: plain and human, no hyphens or em dashes.
- Secrets (Resend key, admin password) go in Cloudflare's variables and
  secrets only, never in the code, the chat or a URL.
