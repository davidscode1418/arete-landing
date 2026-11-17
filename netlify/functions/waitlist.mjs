// The landing page's own backend: /api/waitlist on areteprograms.net.
// Runs as a Netlify Function and keeps sign ups in Netlify Blobs (store
// "waitlist"). Nothing here talks to the Arete app or its database.
//
//   GET  /api/waitlist/status   slots taken and left (public)
//   POST /api/waitlist          join: {name, email, sport, watch, source, consent, company}
//   POST /api/waitlist/leave    {token} from the link in the confirmation email
//   GET  /api/waitlist/admin    everyone on the list; needs
//                               "Authorization: Bearer <ADMIN_PASSWORD>"
//
// Settings (Netlify > Site configuration > Environment variables):
//   ADMIN_PASSWORD   the password for admin.html
//   RESEND_API_KEY   a Resend key for the confirmation email (optional:
//                    without it sign ups are still saved, just not emailed)
//   EMAIL_FROM       e.g. "Arete <hello@areteprograms.net>", on a domain
//                    verified in Resend
//   SITE_URL         https://areteprograms.net (used in the leave link)

import { getStore } from '@netlify/blobs'
import { Problem, everyone, join, leave, passwordMatches, status } from '../lib/waitlist.mjs'

const recent = new Map() // per address sign up times, per running instance
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

async function sendEmail(mail) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`RESEND_API_KEY isn't set; no email sent to ${mail.to}`)
    return false
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Arete <hello@areteprograms.net>',
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

export default async (req, context) => {
  const store = getStore({ name: 'waitlist', consistency: 'strong' })
  const path = new URL(req.url).pathname.replace(/\/+$/, '')
  try {
    if (req.method === 'GET' && path === '/api/waitlist/status') {
      return json(await status(store))
    }
    if (req.method === 'POST' && path === '/api/waitlist') {
      const body = await req.json().catch(() => ({}))
      if (body.company) {
        // The hidden field was filled in: a bot. Look fine, save nothing.
        return json({ position: 101, slots: 100, has_slot: false, already: false })
      }
      if (tooMany(context.ip || 'unknown')) {
        return json({ detail: 'Too many sign ups from here. Try again in a few minutes.' }, 429)
      }
      const pageUrl = (process.env.SITE_URL || process.env.URL || 'https://areteprograms.net').replace(/\/$/, '')
      return json(await join(store, body, { send: sendEmail, pageUrl }))
    }
    if (req.method === 'POST' && path === '/api/waitlist/leave') {
      const body = await req.json().catch(() => ({}))
      return (await leave(store, body.token))
        ? json({ ok: true })
        : json({ detail: 'That link has already been used, or isn’t right.' }, 404)
    }
    if (req.method === 'GET' && path === '/api/waitlist/admin') {
      const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
      if (!passwordMatches(given, process.env.ADMIN_PASSWORD)) return json({ detail: 'Wrong password.' }, 401)
      return json(await everyone(store))
    }
    return json({ detail: 'Not found.' }, 404)
  } catch (err) {
    if (err instanceof Problem) return json({ detail: err.message }, err.status)
    console.error(err)
    return json({ detail: 'Something went wrong. Try again in a minute.' }, 500)
  }
}

export const config = { path: ['/api/waitlist', '/api/waitlist/*'] }
