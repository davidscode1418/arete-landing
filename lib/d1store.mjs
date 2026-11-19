// The waiting list's storage on Cloudflare: one D1 (SQLite) table of keys
// and JSON values. It offers the same four calls the rules in
// lib/waitlist.mjs use (get, setJSON, delete, list), so those rules don't
// care where the data lives. D1 is strongly consistent, and "only if new"
// is a plain INSERT OR IGNORE, so one email can only ever claim one place.

const SCHEMA = 'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)'

export function d1Store(db) {
  let ready = null
  const init = () => (ready ||= db.prepare(SCHEMA).run())

  return {
    async get(key) {
      await init()
      const row = await db.prepare('SELECT v FROM kv WHERE k = ?').bind(key).first()
      return row ? JSON.parse(row.v) : null
    },
    async setJSON(key, value, opts = {}) {
      await init()
      const sql = opts.onlyIfNew
        ? 'INSERT OR IGNORE INTO kv (k, v) VALUES (?, ?)'
        : 'INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v'
      const res = await db.prepare(sql).bind(key, JSON.stringify(value)).run()
      return { modified: (res.meta?.changes ?? 1) > 0 }
    },
    async delete(key) {
      await init()
      await db.prepare('DELETE FROM kv WHERE k = ?').bind(key).run()
    },
    async list({ prefix = '' } = {}) {
      await init()
      const { results } = await db
        .prepare('SELECT k FROM kv WHERE substr(k, 1, ?) = ? ORDER BY k')
        .bind(prefix.length, prefix)
        .all()
      return { blobs: results.map((r) => ({ key: r.k, etag: '' })), directories: [] }
    },
  }
}
