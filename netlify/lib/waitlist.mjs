// The waiting list: who joined, in what order, and the 100 test slots.
// Everything here takes the store and the mailer as arguments, so it runs
// the same on Netlify (Netlify Blobs) and in the tests (an in-memory store).
//
// Keys in the "waitlist" store:
//   e/<13 digit ms time>-<random>  one sign up (name, email, sport, watch,
//                                  source, leave token, joined). Sorted by
//                                  key is sign up order.
//   m/<sha256 of email>            points at that person's e/ key, so the
//                                  same email can't join twice.
//   t/<leave token>                points at the e/ key, for the leave link.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const SLOTS = 100
const SPORTS = ['triathlon', 'running', 'both']
const WATCHES = ['garmin', 'strava', 'other']
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class Problem extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

const sha = (s) => createHash('sha256').update(s).digest('hex')

async function entryKeys(store) {
  const { blobs } = await store.list({ prefix: 'e/' })
  return blobs.map((b) => b.key).sort()
}

export async function status(store) {
  const total = (await entryKeys(store)).length
  return { slots: SLOTS, taken: Math.min(total, SLOTS), total }
}

async function placeOf(store, key) {
  const keys = await entryKeys(store)
  return keys.indexOf(key) + 1
}

function result(place, already) {
  return { position: place, slots: SLOTS, has_slot: place <= SLOTS, already }
}

export async function join(store, input, { now = Date.now(), send = async () => false, pageUrl }) {
  const email = normalizeEmail(input.email)
  const name = String(input.name || '').trim().slice(0, 80)
  if (!name) throw new Problem(422, 'Add your name.')
  if (!EMAIL_SHAPE.test(email) || email.length > 254) throw new Problem(422, "That doesn't look like an email address.")
  if (input.consent !== true) throw new Problem(422, 'Tick the box so I can email you about the test.')

  const mKey = `m/${sha(email)}`
  const existing = await store.get(mKey, { type: 'json' })
  if (existing) {
    const place = await placeOf(store, existing.key)
    if (place > 0) return result(place, true)
  }

  const key = `e/${String(now).padStart(13, '0')}-${randomBytes(4).toString('hex')}`
  const token = randomBytes(24).toString('base64url')
  // Claim the email first: if two sign ups with the same email race, only
  // one gets in.
  const claim = await store.setJSON(mKey, { key }, existing ? {} : { onlyIfNew: true })
  if (claim && claim.modified === false) {
    const again = await store.get(mKey, { type: 'json' })
    return result(await placeOf(store, again.key), true)
  }
  const entry = {
    name,
    email,
    sport: SPORTS.includes(input.sport) ? input.sport : null,
    watch: WATCHES.includes(input.watch) ? input.watch : null,
    source: String(input.source || '').trim().toLowerCase().slice(0, 40) || null,
    token,
    joined: new Date(now).toISOString(),
  }
  await store.setJSON(key, entry)
  await store.setJSON(`t/${token}`, { key, mKey })
  const place = await placeOf(store, key)
  await send(welcomeEmail(entry, place, pageUrl))
  return result(place, false)
}

export async function leave(store, token) {
  if (!token || typeof token !== 'string') return false
  const ref = await store.get(`t/${token}`, { type: 'json' })
  if (!ref) return false
  await store.delete(ref.key)
  await store.delete(ref.mKey)
  await store.delete(`t/${token}`)
  return true
}

export async function everyone(store) {
  const keys = await entryKeys(store)
  const rows = []
  for (let i = 0; i < keys.length; i++) {
    const e = await store.get(keys[i], { type: 'json' })
    if (e) rows.push({ position: i + 1, name: e.name, email: e.email, sport: e.sport, watch: e.watch, source: e.source, joined: e.joined })
  }
  return rows
}

export function passwordMatches(given, expected) {
  if (!expected || !given) return false
  const a = Buffer.from(sha(String(given)))
  const b = Buffer.from(sha(String(expected)))
  return timingSafeEqual(a, b)
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function welcomeEmail(entry, place, pageUrl = 'https://areteprograms.net') {
  const first = entry.name.split(' ')[0] || 'there'
  const leaveLink = `${pageUrl}/?leave=${entry.token}`
  const hasSlot = place <= SLOTS
  const subject = hasSlot ? `You're number ${place} of ${SLOTS} on the Arete test list` : "You're on the Arete waiting list"
  const lead = hasSlot
    ? `You're number ${place} of ${SLOTS}, so you have a test slot. When testing opens I'll email you an invite and you'll be training with Arete before anyone else.`
    : `The ${SLOTS} test slots are taken, but you're on the list at number ${place}. If a slot frees up it goes to the next in line, and you'll hear about early access first.`
  const about = "Arete is a coach that plans your season back from race day and adjusts every session to how you slept, how your legs feel and the load you're carrying."
  const quiet = 'Until then, the only emails you get from me are about the test and the launch.'
  const text = `Hi ${first},\n\n${lead}\n\n${about}\n\n${quiet}\n\nDavid\nArete\n\nNot for you after all? Take yourself off the list: ${leaveLink}`
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#0a0c0d;font-family:Helvetica,Arial,sans-serif;color:#e8ecee">
<div style="max-width:520px;margin:0 auto;background:#121619;border:1px solid #23292d;padding:28px">
<p style="margin:0 0 18px;font-family:Menlo,monospace;font-weight:700;letter-spacing:0.18em;font-size:13px">ARETE</p>
<p style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;line-height:1.3">Hi ${esc(first)}. <span style="color:#c8f031">${hasSlot ? `Your test slot is number ${place}.` : "You're on the list."}</span></p>
<p style="margin:0 0 14px;line-height:1.55;color:#c9d0d4">${esc(lead)}</p>
<p style="margin:0 0 14px;line-height:1.55;color:#c9d0d4">${esc(about)}</p>
<p style="margin:0 0 22px;line-height:1.55;color:#c9d0d4">${esc(quiet)}</p>
<p style="margin:0;line-height:1.55">David</p>
<p style="margin:26px 0 0;font-size:12px;color:#8b969c">Not for you after all? <a href="${esc(leaveLink)}" style="color:#8b969c">Take yourself off the list</a>.</p>
</div></body></html>`
  return { to: entry.email, subject, text, html }
}
