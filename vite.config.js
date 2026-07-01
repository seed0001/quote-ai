import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const HOST_CONFIG_FILE = path.resolve(process.cwd(), '.quote-flow-host-config.json')
// Folder on THIS computer where all shared business data lives. Every employee
// (local or over the tunnel) reads and writes these files, so the data never
// lives in an individual browser.
const DATA_DIR = path.resolve(process.cwd(), 'quote-flow-data')
const DATA_COLLECTIONS = ['projects', 'clients', 'catalog', 'tasks']
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
  'openRouterVisionModel',
  'fishAudioModel',
  'fishVoiceId',
  'fishVoiceName',
  'notificationFromEmail',
  'team',
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
    resendConfigured: Boolean(config.resendKey),
    tavilyConfigured: Boolean(config.tavilyKey),
    braveSearchConfigured: Boolean(config.braveSearchKey),
    stripeConfigured: Boolean(config.stripeKey),
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

const tavilySearch = async (query, apiKey) => {
  if (!apiKey) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, max_results: 5, include_answer: false })
    })
    if (!res.ok) throw new Error(`Tavily error ${res.status}`)
    const data = await res.json()
    return (data.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.content }))
  } catch (e) {
    console.error('Tavily search error', e)
    return []
  }
}

const braveSearch = async (query, apiKey) => {
  if (!apiKey) return []
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey }
    })
    if (!res.ok) throw new Error(`Brave error ${res.status}`)
    const data = await res.json()
    return (data.web?.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.description }))
  } catch (e) {
    console.error('Brave search error', e)
    return []
  }
}

// ---- Email delivery (Resend) + autonomous reminder scheduler ------------
const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Send one email through Resend. Returns { ok, error }. No-ops (ok:false) when
// the key or recipient is missing so the scheduler can keep going.
const sendEmail = async ({ apiKey, from, to, subject, html }) => {
  if (!apiKey) return { ok: false, error: 'Resend not configured' }
  if (!to) return { ok: false, error: 'No recipient' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, error: data?.message || `Resend error ${response.status}` }
    return { ok: true, id: data?.id }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Completed' }

const emailShell = (company, heading, bodyHtml) =>
  `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a202c">
    <h2 style="color:#2d3748">${escapeHtml(heading)}</h2>
    ${bodyHtml}
    <p style="margin-top:24px;color:#718096;font-size:12px">Sent automatically by ${escapeHtml(company || 'QuoteFlow')}.</p>
  </div>`

// The autonomous loop: every few minutes, look for tasks that are due soon or
// have changed status and email the assignee (and the customer, if they opted
// in). Bookkeeping fields on each task prevent duplicate sends. Runs only while
// this server process is alive — that is the host's job.
const runReminderScheduler = async () => {
  const config = readHostConfig()
  const apiKey = config.resendKey
  if (!apiKey) return // nothing configured yet
  const from = config.notificationFromEmail || 'QuoteFlow <onboarding@resend.dev>'
  const company = config.companyName || 'QuoteFlow'

  const tasks = readCollection('tasks')
  if (tasks.length === 0) return
  const clients = readCollection('clients')
  const clientEmail = (id) => clients.find((c) => c.id === id)?.email || ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let changed = false

  for (const task of tasks) {
    if (!task || typeof task !== 'object') continue
    task.notify = task.notify || {}

    const assignee = task.assigneeEmail || config.email || config.notificationFromEmail || ''
    const customer = task.customerOptIn ? clientEmail(task.clientId) : ''
    const when = task.date ? `${task.date}${task.time ? ' ' + task.time : ''}` : 'unscheduled'

    // First time we see a task, record its status silently so we only email on
    // genuine *changes* afterwards (no blast when reminders are first enabled).
    if (task.notify.lastStatus === undefined) {
      task.notify.lastStatus = task.status || 'todo'
      changed = true
    } else if ((task.status || 'todo') !== task.notify.lastStatus && task.status !== 'done') {
      const label = STATUS_LABELS[task.status] || task.status
      const body = `<p>The status of <strong>${escapeHtml(task.title)}</strong> is now <strong>${escapeHtml(label)}</strong>.</p>
        <p>Scheduled for: ${escapeHtml(when)}</p>`
      await sendEmail({ apiKey, from, to: assignee, subject: `Update: ${task.title}`, html: emailShell(company, 'Task status updated', body) })
      if (customer) {
        await sendEmail({ apiKey, from, to: customer, subject: `Project update from ${company}`, html: emailShell(company, 'Your project was updated', `<p>Hello,</p><p>An update on your project: <strong>${escapeHtml(task.title)}</strong> is now <strong>${escapeHtml(label)}</strong>.</p>`) })
      }
      task.notify.lastStatus = task.status
      changed = true
    }

    // Due reminder — fires once when within the lead window.
    if (task.date && task.status !== 'done' && !task.notify.reminded) {
      const due = new Date(`${task.date}T00:00:00`)
      const lead = Number.isFinite(Number(task.reminderLeadDays)) ? Number(task.reminderLeadDays) : 1
      const remindOn = new Date(due)
      remindOn.setDate(due.getDate() - lead)
      if (!Number.isNaN(due.getTime()) && today >= remindOn && today <= due) {
        const body = `<p><strong>${escapeHtml(task.title)}</strong> is scheduled for <strong>${escapeHtml(when)}</strong>.</p>
          ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}`
        await sendEmail({ apiKey, from, to: assignee, subject: `Reminder: ${task.title}`, html: emailShell(company, 'Upcoming task reminder', body) })
        if (customer) {
          await sendEmail({ apiKey, from, to: customer, subject: `Reminder from ${company}`, html: emailShell(company, 'Upcoming appointment', `<p>Hello,</p><p>This is a reminder that <strong>${escapeHtml(task.title)}</strong> is scheduled for <strong>${escapeHtml(when)}</strong>.</p>`) })
        }
        task.notify.reminded = new Date().toISOString()
        changed = true
      }
    }
  }

  if (changed) writeCollection('tasks', tasks)
}

let schedulerStarted = false
const startReminderScheduler = () => {
  if (schedulerStarted) return
  schedulerStarted = true
  // Kick once shortly after boot, then every 5 minutes.
  setTimeout(() => { runReminderScheduler().catch((e) => console.error('Scheduler error', e)) }, 10_000)
  setInterval(() => { runReminderScheduler().catch((e) => console.error('Scheduler error', e)) }, 5 * 60 * 1000)
}

const hostConfigPlugin = {
  name: 'quote-flow-host-config',
  configureServer(server) {
    startReminderScheduler()
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
          if (incoming.resendKey) next.resendKey = incoming.resendKey
          if (incoming.tavilyKey) next.tavilyKey = incoming.tavilyKey
          if (incoming.braveSearchKey) next.braveSearchKey = incoming.braveSearchKey
          if (incoming.stripeKey) next.stripeKey = incoming.stripeKey
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

        // The reminder scheduler owns each task's `notify` bookkeeping. Never
        // let a client write clobber it, or status/reminder emails misfire.
        const preserveServerFields = (incoming, existing) => {
          if (collection !== 'tasks') return incoming
          const merged = { ...incoming }
          delete merged.notify
          if (existing && existing.notify !== undefined) merged.notify = existing.notify
          return merged
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
          const saved = preserveServerFields(record, index === -1 ? null : records[index])
          if (index === -1) records.push(saved)
          else records[index] = saved // idempotent: treat repeat POST as upsert
          writeCollection(collection, records)
          sendJson(res, 200, saved)
          return
        }

        // PUT /api/data/:collection/:id — replace one record.
        if (req.method === 'PUT' && id) {
          const record = JSON.parse((await readBody(req)) || '{}')
          const records = readCollection(collection)
          const index = records.findIndex((r) => r.id === id)
          const saved = preserveServerFields({ ...record, id }, index === -1 ? null : records[index])
          if (index === -1) records.push(saved)
          else records[index] = saved
          writeCollection(collection, records)
          sendJson(res, 200, saved)
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
    // cross-origin wall and aggregates multiple search providers.
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
        const config = readHostConfig()
        const q = query.trim()
        
        // Execute all searches concurrently
        const [ddg, tavily, brave] = await Promise.allSettled([
          duckDuckGoSearch(q),
          tavilySearch(q, config.tavilyKey),
          braveSearch(q, config.braveSearchKey)
        ])
        
        // Aggregate and deduplicate by URL
        const allResults = [
          ...(ddg.status === 'fulfilled' ? ddg.value : []),
          ...(tavily.status === 'fulfilled' ? tavily.value : []),
          ...(brave.status === 'fulfilled' ? brave.value : [])
        ]
        
        const uniqueUrls = new Set()
        const deduplicated = []
        for (const r of allResults) {
          if (!uniqueUrls.has(r.url)) {
            uniqueUrls.add(r.url)
            deduplicated.push(r)
          }
        }
        
        sendJson(res, 200, { query: q, results: deduplicated.slice(0, 10) })
      } catch (error) {
        sendJson(res, 502, { error: `Search failed: ${error.message}` })
      }
    })

    // Send a test email and force an immediate scheduler pass. Host-only, so a
    // tunnel user can't use it to blast emails through the owner's account.
    server.middlewares.use('/api/notify', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }
      if (req.headers['cf-connecting-ip']) {
        sendJson(res, 403, { error: 'Email tests can only be run from the hosting computer.' })
        return
      }
      try {
        const incoming = JSON.parse((await readBody(req)) || '{}')
        const config = readHostConfig()
        if (!config.resendKey) {
          sendJson(res, 400, { error: 'Add a Resend API key in Settings first.' })
          return
        }
        const from = config.notificationFromEmail || 'QuoteFlow <onboarding@resend.dev>'
        const company = config.companyName || 'QuoteFlow'
        const result = await sendEmail({
          apiKey: config.resendKey,
          from,
          to: incoming.to,
          subject: `Test email from ${company}`,
          html: emailShell(company, 'Reminders are working', '<p>This confirms your QuoteFlow reminder emails are configured correctly.</p>'),
        })
        // Also run the scheduler now so any already-due tasks go out immediately.
        runReminderScheduler().catch((e) => console.error('Scheduler error', e))
        if (!result.ok) {
          sendJson(res, 502, { error: result.error })
          return
        }
        sendJson(res, 200, { sent: true, id: result.id })
      } catch (error) {
        sendJson(res, 400, { error: error.message })
      }
    })

    // Create a secure Stripe Checkout Session URL on the fly.
    // Authorized for any local tunnel user so they can bill clients.
    server.middlewares.use('/api/stripe/checkout', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }
      try {
        const config = readHostConfig()
        if (!config.stripeKey) {
          sendJson(res, 400, { error: 'Stripe API key is not configured.' })
          return
        }
        const body = JSON.parse((await readBody(req)) || '{}')
        if (!body.total || !body.projectName) {
          sendJson(res, 400, { error: 'Missing total or projectName.' })
          return
        }

        const form = new URLSearchParams()
        form.append('payment_method_types[0]', 'card')
        form.append('line_items[0][price_data][currency]', 'usd')
        form.append('line_items[0][price_data][product_data][name]', `Quote: ${body.projectName}`)
        form.append('line_items[0][price_data][unit_amount]', Math.round(body.total * 100).toString()) // Cents
        form.append('line_items[0][quantity]', '1')
        form.append('mode', 'payment')
        form.append('success_url', 'http://localhost:5173/?payment=success') // You can update this to the real prod domain later
        if (body.email) form.append('customer_email', body.email)

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: form.toString()
        })
        
        const data = await stripeRes.json()
        if (!stripeRes.ok) {
          sendJson(res, 502, { error: data.error?.message || 'Stripe error' })
          return
        }
        sendJson(res, 200, { url: data.url })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    // Dispatch a generic email (used for Quotes and AI ad-hoc emails)
    server.middlewares.use('/api/email/send', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }
      try {
        const config = readHostConfig()
        if (!config.resendKey) {
          sendJson(res, 400, { error: 'Resend API key is not configured.' })
          return
        }
        
        const body = JSON.parse((await readBody(req)) || '{}')
        if (!body.clientEmail || !body.htmlBody) {
          sendJson(res, 400, { error: 'Missing clientEmail or htmlBody.' })
          return
        }

        const from = config.notificationFromEmail || 'QuoteFlow <onboarding@resend.dev>'
        const company = config.companyName || 'QuoteFlow'
        
        const result = await sendEmail({
          apiKey: config.resendKey,
          from,
          to: body.clientEmail,
          subject: body.subject || `Your Quote from ${company}`,
          html: body.htmlBody,
        })
        
        if (!result.ok) {
          sendJson(res, 502, { error: result.error })
          return
        }
        sendJson(res, 200, { sent: true, id: result.id })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
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
    watch: {
      ignored: ['**/quote-flow-data/**', '**/.quote-flow-host-config.json']
    },
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
