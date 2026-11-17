// npm test   (no Netlify needed: an in-memory store stands in for Blobs)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SLOTS, everyone, join, leave, passwordMatches, status } from '../netlify/lib/waitlist.mjs'

function memoryStore() {
  const m = new Map()
  return {
    async get(key) {
      return m.has(key) ? JSON.parse(m.get(key)) : null
    },
    async setJSON(key, value, opts = {}) {
      if (opts.onlyIfNew && m.has(key)) return { modified: false }
      m.set(key, JSON.stringify(value))
      return { modified: true }
    },
    async delete(key) {
      m.delete(key)
    },
    async list({ prefix = '' } = {}) {
      return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, etag: '' })), directories: [] }
    },
    m,
  }
}

const person = (email, extra = {}) => ({ name: 'Ana Runner', email, sport: 'running', watch: 'garmin', source: 'LinkedIn', consent: true, ...extra })

test('first sign up gets slot one and a welcome email with a leave link', async () => {
  const s = memoryStore()
  const sent = []
  const r = await join(s, person('a@example.com'), { now: 1000, send: async (m) => sent.push(m), pageUrl: 'https://areteprograms.net' })
  assert.deepEqual(r, { position: 1, slots: 100, has_slot: true, already: false })
  assert.equal(sent.length, 1)
  assert.match(sent[0].subject, /number 1 of 100/)
  assert.match(sent[0].text, /https:\/\/areteprograms\.net\/\?leave=/)
  assert.deepEqual(await status(s), { slots: 100, taken: 1, total: 1 })
  const [row] = await everyone(s)
  assert.equal(row.source, 'linkedin')
  assert.equal(row.email, 'a@example.com')
})

test('the same email joining again keeps its first place', async () => {
  const s = memoryStore()
  await join(s, person('a@example.com'), { now: 1 })
  await join(s, person('b@example.com'), { now: 2 })
  const r = await join(s, person(' A@Example.com '), { now: 3 })
  assert.deepEqual(r, { position: 1, slots: 100, has_slot: true, already: true })
  assert.equal((await status(s)).total, 2)
})

test('after 100 you are next in line', async () => {
  const s = memoryStore()
  for (let i = 0; i < SLOTS; i++) await join(s, person(`p${i}@example.com`), { now: 1000 + i })
  const r = await join(s, person('late@example.com'), { now: 5000 })
  assert.deepEqual(r, { position: 101, slots: 100, has_slot: false, already: false })
  assert.deepEqual(await status(s), { slots: 100, taken: 100, total: 101 })
})

test('bad input is refused', async () => {
  const s = memoryStore()
  await assert.rejects(join(s, person('nope'), {}), /email address/)
  await assert.rejects(join(s, person('a@example.com', { name: '  ' }), {}), /name/)
  await assert.rejects(join(s, person('a@example.com', { consent: false }), {}), /Tick the box/)
  assert.equal((await status(s)).total, 0)
})

test('the leave link deletes everything about that person, once', async () => {
  const s = memoryStore()
  const sent = []
  await join(s, person('a@example.com'), { send: async (m) => sent.push(m) })
  const token = sent[0].text.match(/leave=([\w-]+)/)[1]
  assert.equal(await leave(s, token), true)
  assert.equal(s.m.size, 0)
  assert.equal(await leave(s, token), false)
  // and they can join again afterwards
  const r = await join(s, person('a@example.com'), {})
  assert.equal(r.already, false)
})

test('admin password check', () => {
  assert.equal(passwordMatches('secret one', 'secret one'), true)
  assert.equal(passwordMatches('secret', 'secret one'), false)
  assert.equal(passwordMatches('anything', undefined), false)
})
