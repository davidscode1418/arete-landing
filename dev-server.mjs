// Run the page and its backend on your own computer, the way Netlify runs
// them: node dev-server.mjs, then open http://localhost:8888
// Sign ups are kept in .netlify/blobs-local (not in git). Emails are only
// logged unless RESEND_API_KEY is set.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { BlobsServer } from '@netlify/blobs/server'

const ROOT = new URL('.', import.meta.url).pathname
const PORT = Number(process.env.PORT || 8888)
const blobs = new BlobsServer({ directory: join(ROOT, '.netlify/blobs-local'), token: 'local', port: PORT + 1 })
await blobs.start()
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({
  siteID: 'local', token: 'local', edgeURL: `http://localhost:${PORT + 1}`, uncachedEdgeURL: `http://localhost:${PORT + 1}`,
})).toString('base64')
process.env.ADMIN_PASSWORD ||= 'local admin'
process.env.SITE_URL ||= `http://localhost:${PORT}`
const { default: handler } = await import('./netlify/functions/waitlist.mjs')

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }
const REWRITE = { '/privacy': '/privacy.html', '/admin': '/admin.html', '/': '/index.html' }

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname.startsWith('/api/waitlist')) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const r = await handler(new Request(url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), { ip: req.socket.remoteAddress })
    res.writeHead(r.status, Object.fromEntries(r.headers))
    return res.end(Buffer.from(await r.arrayBuffer()))
  }
  const path = normalize(REWRITE[url.pathname] || url.pathname)
  try {
    const body = await readFile(join(ROOT, path))
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`))
