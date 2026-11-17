# Arete landing page (areteprograms.net)

The coming soon page for Arete, with its waiting list. This is its own
project: its own repository, its own Netlify site, its own backend and
storage. It promotes the Arete app (areteprograms.com) but shares no code,
server or database with it. Never change the app from here.

## How it's built

- `index.html`, `styles.css`, `main.js`: the page. Plain files, no build.
  Setting at the top of `main.js`: `VIDEO_ID`.
- `netlify/functions/waitlist.mjs`: the backend (`/api/waitlist`), a
  Netlify Function. Sign ups are kept in Netlify Blobs, store "waitlist".
- `netlify/lib/waitlist.mjs`: the waiting list rules (100 early access spots, sign
  up order, one place per email, the leave link, the welcome email).
- `admin.html`: the list, behind `ADMIN_PASSWORD`.
- `privacy.html`: the privacy policy for the waiting list.

## Commands

- `npm install` once.
- `npm test` runs the waiting list tests.
- `node dev-server.mjs` runs the page and backend at http://localhost:8888
  (admin password "local admin").

## Rules

- The look follows the Arete app's "Serif voice" design: dark by default,
  light on request, IBM Plex Sans Condensed, JetBrains Mono, Fraunces, one
  lime accent.
- Copy: plain and human, no hyphens or em dashes.
- Secrets (Resend key, admin password) go in Netlify's environment
  variables only, never in the code, the chat or a URL.
