// The Cloudflare Worker for areteprograms.net. /api/waitlist goes to the
// waiting list backend; everything else is the page itself, served from
// public/ (wrangler.jsonc), with public/_headers applied.

import { waitlistApi } from './waitlist-api.js'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/waitlist' || pathname.startsWith('/api/waitlist/')) {
      return waitlistApi(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}
