import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const HOST_CONFIG_FILE = path.resolve(process.cwd(), '.quote-flow-host-config.json')
// Folder on THIS computer where all shared business data lives. Every employee
// (local or over the tunnel) reads and writes these files, so the data never
// lives in an individual browser.
const DATA_DIR = path.resolve(process.cwd(), 'quote-flow-data')
const DATA_COLLECTIONS = ['projects', 'clients', 'catalog']
const PUBLIC_CONFIG_FIELDS = [
  'companyName',
  'businessType',
  'businessDescription',
  'personaStatement',
  'contractorName',
  'email',
  'phone',
  'address',
  'defaultLaborRate',
  'defaultMarkupPercent',
  'defaultTaxPercent',
  'depositPercent',
  'proposalTerms',
  'companyLogo',
  'openRouterModel',
  'fishAudioModel',
  'fishVoiceId',
  'fishVoiceName',
]

const readHostConfig = () => {
  try {
    return JSON.parse(fs.readFileSync(HOST_CONFIG_FILE, 'utf8'))
  } catch {
    return {}
  }
}

const publicHostConfig = () => {
  const config = readHostConfig()
  const exposed = Object.fromEntries(
    PUBLIC_CONFIG_FIELDS
      .filter((field) => config[field] !== undefined)
      .map((field) => [field, config[field]])
  )
  return {
    ...exposed,
    openRouterConfigured: Boolean(config.openRouterKey),
    fishAudioConfigured: Boolean(config.fishAudioKey),
  }
}

const sendJson = (res, status, payload) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

// ---- Shared data store (projects / clients / catalog) -------------------
// Each collection is a flat JSON array on disk. Reads/writes are synchronous so
// a single request's read-modify-write runs to completion before the event loop
// services the next one — that's what makes the per-record updates below safe
// when several employees save at the same time.
const collectionFile = (name) => path.resolve(DATA_DIR, `${name}.json`)

const readCollection = (name) => {
  try {
    const parsed = JSON.parse(fs.readFileSync(collectionFile(name), 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeCollection = (name, records) => {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(collectionFile(name), JSON.stringify(records, null, 2), 'utf8')
}

const readBody = (req, limit = 12_000_000) =>
  new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > limit) {
        req.destroy()
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })

// ---- DuckDuckGo web search (no API key required) ------------------------
const decodeEntities = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const unwrapDdgUrl = (href) => {
  const match = href.match(/[?&]uddg=([^&]+)/)
  if (match) return decodeURIComponent(match[1])
  if (href.startsWith('//')) return `https:${href}`
  return href
}

const duckDuckGoSearch = async (query) => {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!response.ok) throw new Error(`DuckDuckGo returned ${response.status}`)
  const html = await response.text()

  // The markup nests several <div class="result__..."> wrappers per result, so
  // splitting isn't reliable. Instead, index every snippet by position and pair
  // each title with the next snippet that follows it. Sponsored links carry a
  // uddg param too, but it decodes to a duckduckgo y.js tracker — drop those.
  const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ index: m.index, text: decodeEntities(m[1]) }))
  const snippetAfter = (pos) => {
    const match = snippets.find((s) => s.index > pos)
    return match ? match.text : ''
  }

  const results = []
  for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const url = unwrapDdgUrl(m[1])
    if (/duckduckgo\.com\/y\.js|ad_provider=|ad_domain=/.test(url)) continue // sponsored
    results.push({ title: decodeEntities(m[2]), url, snippet: snippetAfter(m.index) })
    if (results.length >= 6) break
  }
  return results
}

const hostConfigPlugin = {
  name: 'quote-flow-host-config',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = (req.url || '').split('?')[0]
      const allowed =
        (pathname === '/api/openrouter/api/v1/chat/completions' && req.method === 'POST')
        || (pathname === '/api/openrouter/api/v1/models/user' && req.method === 'GET')
        || (pathname === '/api/fish/model' && req.method === 'GET')
        || (pathname === '/api/fish/v1/tts' && req.method === 'POST')
        || pathname === '/api/host-config'

      if ((pathname.startsWith('/api/openrouter') || pathname.startsWith('/api/fish')) && !allowed) {
        sendJson(res, 404, { error: 'API route not available.' })
        return
      }
      next()
    })

    server.middlewares.use('/api/host-config', (req, res) => {
      if (req.method === 'GET') {
        sendJson(res, 200, publicHostConfig())
        return
      }

      if (req.method === 'DELETE') {
        if (req.headers['cf-connecting-ip']) {
          sendJson(res, 403, { error: 'Host configuration can only be changed on the hosting computer.' })
          return
        }
        try {
          fs.rmSync(HOST_CONFIG_FILE, { force: true })
          sendJson(res, 200, { reset: true })
        } catch (error) {
          sendJson(res, 500, { error: error.message })
        }
        return
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      // Cloudflare adds this header. Configuration changes must be made from
      // the host computer through localhost, never from the public tunnel.
      if (req.headers['cf-connecting-ip']) {
        sendJson(res, 403, { error: 'Host configuration can only be changed on the hosting computer.' })
        return
      }

      let body = ''
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 12_000_000) req.destroy()
      })
      req.on('end', () => {
        try {
          const incoming = JSON.parse(body || '{}')
          const current = readHostConfig()
          const next = { ...current }
          PUBLIC_CONFIG_FIELDS.forEach((field) => {
            if (incoming[field] !== undefined) next[field] = incoming[field]
          })
          if (incoming.openRouterKey) next.openRouterKey = incoming.openRouterKey
          if (incoming.fishAudioKey) next.fishAudioKey = incoming.fishAudioKey
          fs.writeFileSync(HOST_CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8')
          sendJson(res, 200, publicHostConfig())
        } catch (error) {
          sendJson(res, 400, { error: error.message })
        }
      })
    })

    // Shared business data. Unlike host-config, tunnel users MAY write here —
    // that is the whole point: every employee's input lands on this computer.
    server.middlewares.use('/api/data', async (req, res) => {
      const pathname = (req.url || '').split('?')[0]
      // req.url is already stripped of the '/api/data' mount prefix.
      const segments = pathname.split('/').filter(Boolean) // [] | [collection] | [collection, id]
      const [collection, id] = segments

      try {
        // GET /api/data — hydrate everything at once.
        if (req.method === 'GET' && segments.length === 0) {
          const data = Object.fromEntries(DATA_COLLECTIONS.map((name) => [name, readCollection(name)]))
          sendJson(res, 200, data)
          return
        }

        // DELETE /api/data — wipe all shared data (used by master reset).
        if (req.method === 'DELETE' && segments.length === 0) {
          DATA_COLLECTIONS.forEach((name) => writeCollection(name, []))
          sendJson(res, 200, { reset: true })
          return
        }

        if (!DATA_COLLECTIONS.includes(collection)) {
          sendJson(res, 404, { error: `Unknown data collection "${collection}".` })
          return
        }

        // POST /api/data/:collection — create one record.
        if (req.method === 'POST' && !id) {
          const record = JSON.parse((await readBody(req)) || '{}')
          if (!record.id) {
            sendJson(res, 400, { error: 'Record must include an id.' })
            return
          }
          const records = readCollection(collection)
          const index = records.findIndex((r) => r.id === record.id)
          if (index === -1) records.push(record)
          else records[index] = record // idempotent: treat repeat POST as upsert
          writeCollection(collection, records)
          sendJson(res, 200, record)
          return
        }

        // PUT /api/data/:collection/:id — replace one record.
        if (req.method === 'PUT' && id) {
          const record = JSON.parse((await readBody(req)) || '{}')
          const records = readCollection(collection)
          const index = records.findIndex((r) => r.id === id)
          if (index === -1) records.push({ ...record, id })
          else records[index] = { ...record, id }
          writeCollection(collection, records)
          sendJson(res, 200, { ...record, id })
          return
        }

        // DELETE /api/data/:collection/:id — remove one record.
        if (req.method === 'DELETE' && id) {
          writeCollection(collection, readCollection(collection).filter((r) => r.id !== id))
          sendJson(res, 200, { deleted: id })
          return
        }

        sendJson(res, 405, { error: 'Method not allowed' })
      } catch (error) {
        sendJson(res, 400, { error: error.message })
      }
    })

    // Internet search for the assistant — proxied so the browser never hits a
    // cross-origin wall and no API key is needed (DuckDuckGo).
    server.middlewares.use('/api/search', async (req, res) => {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }
      const query = new URL(req.url, 'http://localhost').searchParams.get('q')
      if (!query || !query.trim()) {
        sendJson(res, 400, { error: 'Missing search query.' })
        return
      }
      try {
        const results = await duckDuckGoSearch(query.trim())
        sendJson(res, 200, { query: query.trim(), results })
      } catch (error) {
        sendJson(res, 502, { error: `Search failed: ${error.message}` })
      }
    })
  },
}

const injectHostKey = (configField) => (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    const key = readHostConfig()[configField]
    proxyReq.removeHeader('authorization')
    if (key) proxyReq.setHeader('Authorization', `Bearer ${key}`)
  })
}

export default defineConfig({
  plugins: [react(), hostConfigPlugin],
  server: {
    allowedHosts: true,
    proxy: {
      '/api/fish': {
        target: 'https://api.fish.audio',
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api\/fish/, ''),
        configure: injectHostKey('fishAudioKey'),
      },
      '/api/openrouter': {
        target: 'https://openrouter.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api\/openrouter/, ''),
        configure: injectHostKey('openRouterKey'),
      },
    },
  },
})
