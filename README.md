# Arete coming soon page (areteprograms.net)

The landing page for Arete with its own waiting list backend. Separate from
the Arete app: own repository, own Netlify site, own storage.

## What's where

- `index.html`, `styles.css`, `main.js` the page. At the top of `main.js`:
  `VIDEO_ID` (the YouTube id of the video) and `ROADMAP_START` (the day the
  roadmap counts from).
- `netlify/functions/waitlist.mjs` the backend, a Netlify Function at
  `/api/waitlist`. Sign ups are kept in Netlify Blobs.
- `netlify/lib/waitlist.mjs` the waiting list rules: 100 test slots in sign
  up order, one place per email, a welcome email with a leave link.
- `admin.html` (at `/admin`) the list and a CSV download, behind a password.
- `privacy.html` the privacy policy for the waiting list.
- `assets/shots/` screenshots of the app, filled with a made up athlete.
- `assets/og.png` the picture shown when the link is shared.
- `assets/david.jpg` your photo (portrait, about 900 by 1125). Until it
  exists the page shows your initials.

## On your computer

    npm install
    npm test
    node dev-server.mjs      # http://localhost:8888, admin password "local admin"

## Netlify

1. Add new site, Import an existing project, pick this repository. Leave
   the build command empty; publish directory is the repository root.
   Netlify finds the backend in `netlify/functions` by itself.
2. Site configuration, Environment variables:
   - `ADMIN_PASSWORD` a long password for the admin page.
   - `RESEND_API_KEY` a new key from Resend, for the confirmation email.
   - `EMAIL_FROM` e.g. `Arete <hello@areteprograms.net>`, on a domain
     verified in Resend.
   - `SITE_URL` `https://areteprograms.net`
   Without the Resend key, sign ups are still saved; they just don't get
   an email.
3. Domain management: add `areteprograms.net` and follow Netlify's DNS
   steps at the registrar. HTTPS turns on by itself.

## Sharing

Add `?s=linkedin`, `?s=x`, `?s=instagram` or `?s=facebook` to the link you
post on each network. The admin page shows how many sign ups came from each.
