// The landing page's own backend: /api/waitlist on areteprograms.net.
// Called by the Cloudflare Worker (src/worker.js); sign ups are kept in the
// D1 database bound as DB (lib/d1store.mjs, wrangler.jsonc). Nothing here
// talks to the Arete app or its database.
//
//   GET  /api/waitlist/status   spots taken and left (public)
//   POST /api/waitlist          join: {name, email, sport, watch, source, consent, company}
//   POST /api/waitlist/leave    {token} from the link in the confirmation email
//   GET  /api/waitlist/admin    everyone on the list; needs
//                               "Authorization: Bearer <ADMIN_PASSWORD>"
//
// Settings: DB and SITE_URL are in wrangler.jsonc. In Cloudflare
// (Workers & Pages > arete-landing > Settings > Variables and secrets):
//   ADMIN_PASSWORD (secret), and later RESEND_API_KEY (secret) and
//   EMAIL_FROM for the confirmation email. Without RESEND_API_KEY sign ups
//   are still saved, just not emailed.

import { d1Store } from '../lib/d1store.mjs'
import { Problem, everyone, join, leave, passwordMatches, status } from '../lib/waitlist.mjs'

const recent = new Map() // sign up times per address, per running instance
const LIMIT = 5
const WINDOW_MS = 10 * 60 * 1000

function tooMany(ip) {
  const now = Date.now()
  const times = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  if (times.length >= LIMIT) return true
  times.push(now)
  recent.set(ip, times)
  return false
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

function mailer(env) {
  return async (mail) => {
    if (!env.RESEND_API_KEY) {
      console.log(`RESEND_API_KEY isn't set; no email sent to ${mail.to}`)
      return false
    }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.EMAIL_FROM || 'Arete <hello@areteprograms.net>',
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        }),
      })
      if (!r.ok) console.error(`Resend refused the email to ${mail.to}: ${r.status} ${(await r.text()).slice(0, 300)}`)
      return r.ok
    } catch (err) {
      console.error(`Couldn't reach Resend for ${mail.to}`, err)
      return false
    }
  }
}

export async function waitlistApi(request, env) {
  if (!env.DB) return json({ detail: 'The waiting list isn’t set up yet.' }, 503)
  const store = d1Store(env.DB)
  const path = new URL(request.url).pathname.replace(/\/+$/, '')
  try {
    if (request.method === 'GET' && path === '/api/waitlist/status') {
      return json(await status(store))
    }
    if (request.method === 'POST' && path === '/api/waitlist') {
      const body = await request.json().catch(() => ({}))
      if (body.company) {
        // The hidden field was filled in: a bot. Look fine, save nothing.
        return json({ position: 101, slots: 100, has_slot: false, already: false })
      }
      if (tooMany(request.headers.get('cf-connecting-ip') || 'unknown')) {
        return json({ detail: 'Too many sign ups from here. Try again in a few minutes.' }, 429)
      }
      const pageUrl = (env.SITE_URL || 'https://areteprograms.net').replace(/\/$/, '')
      return json(await join(store, body, { send: mailer(env), pageUrl }))
    }
    if (request.method === 'POST' && path === '/api/waitlist/leave') {
      const body = await request.json().catch(() => ({}))
      return (await leave(store, body.token))
        ? json({ ok: true })
        : json({ detail: 'That link has already been used, or isn’t right.' }, 404)
    }
    if (request.method === 'GET' && path === '/api/waitlist/admin') {
      const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
      if (!(await passwordMatches(given, env.ADMIN_PASSWORD))) return json({ detail: 'Wrong password.' }, 401)
      return json(await everyone(store))
    }
    return json({ detail: 'Not found.' }, 404)
  } catch (err) {
    if (err instanceof Problem) return json({ detail: err.message }, err.status)
    console.error(err)
    return json({ detail: 'Something went wrong. Try again in a minute.' }, 500)
  }
}
