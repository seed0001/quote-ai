import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const HOST_CONFIG_FILE = path.resolve(process.cwd(), '.quote-flow-host-config.json')
const PUBLIC_CONFIG_FIELDS = [
  'companyName',
  'businessType',
  'businessDescription',
  'personaStatement',
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
        if (body.length > 1_000_000) req.destroy()
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
