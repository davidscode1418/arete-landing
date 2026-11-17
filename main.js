// Arete coming soon page. No framework, no tracking, no cookies.
//
// Settings you may change:
//   VIDEO_ID       the YouTube id of the 5 minute video (the part after
//                  "watch?v=" or "youtu.be/"). Empty shows "coming soon".
//   ROADMAP_START  the day the roadmap counts from (YYYY-MM-DD).
//
// Sign ups go to this site's own backend (netlify/functions/waitlist.mjs),
// which keeps them in Netlify Blobs. Nothing here talks to the Arete app.
//
// Share links with ?s=linkedin, ?s=x, ?s=instagram or ?s=facebook on the
// end (utm_source works too) and the waiting list records where each sign
// up came from.

const VIDEO_ID = ''
const ROADMAP_START = '2026-11-17'
const API = '/api'
const SLOTS = 100

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)

// --- Light and dark ---------------------------------------------------------

function setTheme(theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem('arete-theme', theme)
  } catch (e) {
    /* private window: fine for this visit */
  }
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'light' ? '#f4f5f2' : '#0a0c0d')
  $('theme-toggle').setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode')
}

$('theme-toggle').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light')
})
setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

// --- Test slots left ----------------------------------------------------------

function drawSlots(taken) {
  const bar = $('slots-bar')
  bar.textContent = ''
  for (let i = 0; i < SLOTS; i++) {
    const cell = document.createElement('i')
    if (i < taken) cell.className = 'taken'
    bar.appendChild(cell)
  }
  $('slots-left').textContent = String(Math.max(0, SLOTS - taken))
}

drawSlots(0)
fetch(`${API}/waitlist/status`)
  .then((r) => (r.ok ? r.json() : null))
  .then((s) => {
    if (s) drawSlots(Math.min(SLOTS, s.taken))
  })
  .catch(() => {})

// --- Roadmap ------------------------------------------------------------------

const DAY = 86400000
const start = new Date(`${ROADMAP_START}T00:00:00`)
const today = new Date()
today.setHours(0, 0, 0, 0)
const elapsed = Math.max(0, Math.round((today - start) / DAY))
const SPAN = 150

function fmt(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

document.querySelectorAll('#milestones li').forEach((li) => {
  const day = Number(li.dataset.day)
  const when = new Date(start.getTime() + day * DAY)
  const left = day - elapsed
  li.querySelector('.m-days').textContent = left > 1 ? `In ${left} days` : left === 1 ? 'Tomorrow' : left === 0 ? 'Today' : 'Open now'
  li.querySelector('.m-date').textContent = fmt(when)
})

$('track-now').style.width = `${Math.min(100, (elapsed / SPAN) * 100)}%`
const marks = [[0, 'Today'], [30, 'Test'], [90, 'Early access'], [120, 'App'], [150, 'Public']]
marks.forEach(([d, name], i) => {
  const s = document.createElement('span')
  s.style.left = `${(d / SPAN) * 100}%`
  s.textContent = i === 0 ? name : `D${d}`
  s.title = name
  $('track-marks').appendChild(s)
})

// --- Video ----------------------------------------------------------------------

const poster = $('video-play')
if (!VIDEO_ID) {
  poster.classList.add('video-soon')
  poster.setAttribute('aria-label', 'The video is coming soon')
  poster.querySelector('.video-meta').innerHTML = '<span class="label">Video</span> David on why he built Arete · coming soon'
} else {
  poster.addEventListener('click', () => {
    // Loaded only on a click, so YouTube sees nothing until someone plays it.
    const f = document.createElement('iframe')
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(VIDEO_ID)}?autoplay=1&rel=0&modestbranding=1`
    f.title = 'Why I built Arete'
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
    f.allowFullscreen = true
    $('video-frame').replaceChildren(f)
  })
}

// --- Join the waiting list ------------------------------------------------------

function source() {
  const s = params.get('s') || params.get('utm_source') || params.get('ref') || ''
  if (s) return s.slice(0, 40).toLowerCase()
  const r = document.referrer
  if (/linkedin\./.test(r)) return 'linkedin'
  if (/(twitter|x)\.com|t\.co/.test(r)) return 'x'
  if (/instagram\./.test(r)) return 'instagram'
  if (/facebook\.|fb\./.test(r)) return 'facebook'
  return ''
}

const form = $('join-form')
const errorBox = $('form-error')

function showError(msg, field) {
  errorBox.textContent = msg
  errorBox.hidden = false
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'))
  if (field) {
    field.setAttribute('aria-invalid', 'true')
    field.focus()
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  errorBox.hidden = true
  const name = $('f-name')
  const email = $('f-email')
  if (!name.value.trim()) return showError('Add your name.', name)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return showError("That doesn't look like an email address.", email)
  if (!$('f-consent').checked) return showError('Tick the box so I can email you about the test.', $('f-consent'))

  const data = new FormData(form)
  const button = $('join-submit')
  button.disabled = true
  button.textContent = 'Joining…'
  try {
    const r = await fetch(`${API}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(),
        email: email.value.trim(),
        sport: data.get('sport'),
        watch: data.get('watch'),
        source: source(),
        consent: true,
        company: data.get('company') || null,
      }),
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = typeof body.detail === 'string' ? body.detail : 'Something went wrong. Try again in a minute.'
      throw new Error(msg)
    }
    joined(body, name.value.trim().split(' ')[0])
  } catch (err) {
    showError(err.message === 'Failed to fetch' ? "Couldn't reach Arete. Check your connection and try again." : err.message)
    button.disabled = false
    button.textContent = 'Join the waiting list'
  }
})

function joined(res, first) {
  const line = $('joined-line')
  const note = $('joined-note')
  const who = first ? `${first}, you're` : "You're"
  if (res.has_slot) {
    line.innerHTML = `${res.already ? 'Already on the list. ' : ''}${who} number <mark>${res.position} of ${res.slots}</mark>. That's a test slot.`
    note.textContent = "Check your inbox for the confirmation. When testing opens you'll get an invite code by email."
  } else {
    line.innerHTML = `${res.already ? 'Already on the list. ' : ''}${who} number <mark>${res.position}</mark> on the list.`
    note.textContent = `The ${res.slots} test slots are taken, so you're next in line if one frees up, and first to hear about early access. Check your inbox for the confirmation.`
  }
  form.hidden = true
  $('joined').hidden = false
  $('joined').focus()
  fetch(`${API}/waitlist/status`)
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => s && drawSlots(Math.min(SLOTS, s.taken)))
    .catch(() => {})
}

// --- Leaving the list (the link in the confirmation email) ---------------------

const leaveToken = params.get('leave')
if (leaveToken) {
  const box = $('left')
  box.hidden = false
  box.scrollIntoView()
  fetch(`${API}/waitlist/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: leaveToken }),
  })
    .then(async (r) => {
      $('left-line').textContent = r.ok
        ? "Done. You're off the waiting list and your details are deleted."
        : "That link has already been used, so you're off the list."
      history.replaceState(null, '', location.pathname)
    })
    .catch(() => {
      $('left-line').textContent = "Couldn't reach Arete. Try the link again in a minute."
    })
}

$('year').textContent = String(new Date().getFullYear())
