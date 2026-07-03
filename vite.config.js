import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'

const HOST_CONFIG_FILE = path.resolve(process.cwd(), '.quote-flow-host-config.json')
// Folder on THIS computer where all shared business data lives. Every employee
// (local or over the tunnel) reads and writes these files, so the data never
// lives in an individual browser.
const DATA_DIR = path.resolve(process.cwd(), 'quote-flow-data')
const DATA_COLLECTIONS = ['projects', 'clients', 'catalog', 'tasks', 'knowledgeBase', 'contacts', 'portalMessages']
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
  'openRouterClassifierModel',
  'classifierSchema',
  'fishAudioModel',
  'fishVoiceId',
  'fishVoiceName',
  'notificationFromEmail',
  'team',
  'portalUrl',
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
    portalSyncConfigured: Boolean(config.portalSyncKey),
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
  // Portal sync rides its own faster loop so client messages arrive promptly.
  setTimeout(() => { runPortalSync().catch((e) => console.error('Portal sync error', e)) }, 15_000)
  setInterval(() => { runPortalSync().catch((e) => console.error('Portal sync error', e)) }, 2 * 60 * 1000)
}

// ---- Client portal -------------------------------------------------------
// Clients reach the portal through a per-client magic link (/portal?token=…).
// Every portal endpoint resolves the token to ONE client record and only ever
// reads or writes data belonging to that client — a portal visitor must never
// be able to touch /api/data or another client's records.
const PORTAL_CHAT_LIMIT = 20 // AI messages per client per hour

const portalChatHits = new Map() // token -> [timestamps]

const portalClientByToken = (token) => {
  if (typeof token !== 'string' || token.length < 12) return null
  return readCollection('clients').find((c) => c.portalToken === token && c.portalEnabled !== false) || null
}

// The client-safe view of their projects: progress and payment info only.
// Internal economics (labor rate, markup, quote line items) stay out.
const portalProjects = (clientId) =>
  readCollection('projects')
    .filter((p) => p.clientId === clientId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status || 'lead',
      summary: p.summary || '',
      startDate: p.startDate || '',
      endDate: p.endDate || '',
      logs: (p.logs || []).map((l) => ({ id: l.id, timestamp: l.timestamp, message: l.message })),
      photos: (p.photos || []).map((ph) => ({ id: ph.id, url: ph.url, title: ph.title || '', phase: ph.phase || '', date: ph.date || '' })),
      milestones: (p.milestones || []).map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description || '',
        amount: Number(m.amount) || 0,
        status: m.status === 'paid' ? 'paid' : 'pending',
        paidAt: m.paidAt || null,
      })),
      checklistProgress: {
        total: (p.checklists || []).length,
        done: (p.checklists || []).filter((c) => c.completed).length,
      },
    }))

const portalMessagesFor = (clientId) =>
  readCollection('portalMessages')
    .filter((m) => m.clientId === clientId)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))

const notifyOwner = (config, subject, bodyHtml) => {
  const to = config.email || ''
  if (!config.resendKey || !to) return
  sendEmail({
    apiKey: config.resendKey,
    from: config.notificationFromEmail || 'QuoteFlow <onboarding@resend.dev>',
    to,
    subject,
    html: emailShell(config.companyName || 'QuoteFlow', subject, bodyHtml),
  })
}

// ---- Cloud portal sync ----------------------------------------------------
// The hub is the only side that opens connections: it PUSHES published client
// data to the cloud portal and PULLS new client messages/payments back. The
// portal (Railway) never connects into this machine.
let portalSyncRunning = false

const runPortalSync = async () => {
  if (portalSyncRunning) return { skipped: true }
  const config = readHostConfig()
  const baseUrl = String(config.portalUrl || '').trim().replace(/\/+$/, '')
  const key = String(config.portalSyncKey || '').trim()
  if (!baseUrl || !key) return { configured: false }
  portalSyncRunning = true
  const summary = { configured: true, ok: true, publishedProjects: 0, newMessages: 0, newPayments: 0 }
  try {
    const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    const clients = readCollection('clients')
    // Anyone who was EVER portal-enabled must keep syncing, so that disabling
    // them locally actually deactivates their portal account too.
    const syncableClients = clients.filter((c) => c.email && c.portalEnabled !== undefined)
    const activeClients = syncableClients.filter((c) => c.portalEnabled)

    // ---- PUBLISH ----
    const projects = []
    activeClients.forEach((c) => {
      portalProjects(c.id).forEach((p) => projects.push({ ...p, clientId: c.id }))
    })
    const allMessages = readCollection('portalMessages')
    const replies = allMessages.filter((m) => m.from === 'owner' && !m.syncedToPortal)

    const publishRes = await fetch(`${baseUrl}/api/sync/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        business: {
          companyName: config.companyName || '',
          businessDescription: config.businessDescription || '',
          companyLogo: config.companyLogo || '',
          email: config.email || '',
          phone: config.phone || '',
        },
        clients: syncableClients.map((c) => ({
          id: c.id,
          name: c.name,
          company: c.company || '',
          email: c.email,
          active: Boolean(c.portalEnabled),
          password: c.portalPasswordPending || undefined,
        })),
        projects,
        fullProjectList: true,
        replies: replies.map((r) => ({ id: r.id, clientId: r.clientId, text: r.text, timestamp: r.timestamp })),
      }),
    })
    if (!publishRes.ok) {
      const err = await publishRes.json().catch(() => ({}))
      throw new Error(err.error || `Portal publish failed (${publishRes.status})`)
    }
    summary.publishedProjects = projects.length

    // Publish succeeded: pending passwords are now set on the portal, and
    // replies are delivered — clear the local bookkeeping.
    if (clients.some((c) => c.portalPasswordPending)) {
      writeCollection('clients', clients.map((c) => {
        if (!c.portalPasswordPending) return c
        const { portalPasswordPending: _pw, ...rest } = c
        return { ...rest, portalPasswordSetAt: new Date().toISOString() }
      }))
    }
    if (replies.length > 0) {
      writeCollection('portalMessages', allMessages.map((m) =>
        replies.some((r) => r.id === m.id) ? { ...m, syncedToPortal: true } : m
      ))
    }

    // ---- PULL ----
    const pullRes = await fetch(`${baseUrl}/api/sync/pull`, { headers })
    if (!pullRes.ok) throw new Error(`Portal pull failed (${pullRes.status})`)
    const pulled = await pullRes.json()
    const clientName = (id) => clients.find((c) => c.id === id)?.name || 'A client'

    const incomingMessages = Array.isArray(pulled.messages) ? pulled.messages : []
    if (incomingMessages.length > 0) {
      const current = readCollection('portalMessages')
      const known = new Set(current.map((m) => m.id))
      for (const m of incomingMessages) {
        if (known.has(m.id)) continue
        current.push({ id: m.id, clientId: m.clientId, from: 'client', text: m.text, timestamp: m.timestamp, read: false, syncedToPortal: true })
        notifyOwner(config, `New portal message from ${clientName(m.clientId)}`,
          `<p>${escapeHtml(m.text)}</p><p style="color:#718096">Reply from the Client Directory in QuoteFlow.</p>`)
        summary.newMessages += 1
      }
      writeCollection('portalMessages', current)
    }

    const incomingPayments = Array.isArray(pulled.payments) ? pulled.payments : []
    if (incomingPayments.length > 0) {
      const allProjects = readCollection('projects')
      let changed = false
      for (const pay of incomingPayments) {
        const project = allProjects.find((p) => p.id === pay.projectId)
        const milestone = project ? (project.milestones || []).find((m) => m.id === pay.milestoneId) : null
        if (project && milestone && milestone.status !== 'paid') {
          milestone.status = 'paid'
          milestone.paidAt = pay.paidAt
          milestone.stripeSessionId = pay.stripeSession
          project.logs = project.logs || []
          project.logs.push({
            id: `log-${Date.now()}-psync-${summary.newPayments}`,
            timestamp: new Date().toISOString(),
            message: `Client paid milestone "${milestone.name}" ($${(Number(pay.amount) || 0).toFixed(2)}) through the portal.`,
          })
          changed = true
          notifyOwner(config, `Payment received: ${milestone.name}`,
            `<p><strong>${escapeHtml(clientName(pay.clientId))}</strong> paid <strong>$${(Number(pay.amount) || 0).toFixed(2)}</strong> for milestone <strong>${escapeHtml(milestone.name)}</strong> on project <strong>${escapeHtml(project.name)}</strong>.</p>`)
        }
        summary.newPayments += 1
      }
      if (changed) writeCollection('projects', allProjects)
    }

    // ---- ACK ---- (only after the pulled records are safely written locally)
    if (incomingMessages.length > 0 || incomingPayments.length > 0) {
      await fetch(`${baseUrl}/api/sync/ack`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messageIds: incomingMessages.map((m) => m.id),
          paymentIds: incomingPayments.map((p) => p.id),
        }),
      })
    }
    return summary
  } catch (error) {
    return { ...summary, ok: false, error: error.message }
  } finally {
    portalSyncRunning = false
  }
}

const hostConfigPlugin = {
  name: 'quote-flow-host-config',
  configureServer(server) {
    startReminderScheduler()
    server.middlewares.use((req, res, next) => {
      const pathname = (req.url || '').split('?')[0]
      const allowed =
        (pathname === '/api/openrouter/api/v1/chat/completions' && req.method === 'POST')
        || (pathname === '/api/openrouter/api/v1/models' && req.method === 'GET')
        || (pathname === '/api/fish/model' && req.method === 'GET')
        || (pathname === '/api/fish/v1/tts' && req.method === 'POST')
        || pathname === '/api/host-config'
        || pathname.startsWith('/api/agent')
        || pathname.startsWith('/api/ollama')

      if ((pathname.startsWith('/api/openrouter') || pathname.startsWith('/api/fish') || pathname.startsWith('/api/ollama')) && !allowed) {
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
          // Trim every key on save so pasted whitespace/newlines never corrupt
          // an auth header downstream.
          if (incoming.openRouterKey) next.openRouterKey = String(incoming.openRouterKey).trim()
          if (incoming.fishAudioKey) next.fishAudioKey = String(incoming.fishAudioKey).trim()
          if (incoming.resendKey) next.resendKey = String(incoming.resendKey).trim()
          if (incoming.tavilyKey) next.tavilyKey = String(incoming.tavilyKey).trim()
          if (incoming.braveSearchKey) next.braveSearchKey = String(incoming.braveSearchKey).trim()
          if (incoming.stripeKey) next.stripeKey = String(incoming.stripeKey).trim()
          if (incoming.portalSyncKey) next.portalSyncKey = String(incoming.portalSyncKey).trim()
          if (incoming.portalUrl !== undefined) next.portalUrl = String(incoming.portalUrl).trim().replace(/\/+$/, '')
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
          if (collection === 'tasks') {
            const merged = { ...incoming }
            delete merged.notify
            if (existing && existing.notify !== undefined) merged.notify = existing.notify
            return merged
          }
          // Stripe payment records are owned by the server (portal
          // verify-payment). A stale employee save must never un-pay or drop a
          // milestone the client already paid for.
          if (collection === 'projects' && existing && Array.isArray(existing.milestones)) {
            const paid = new Map(
              existing.milestones
                .filter((m) => m.status === 'paid' && m.stripeSessionId)
                .map((m) => [m.id, m])
            )
            if (paid.size > 0) {
              const merged = { ...incoming }
              merged.milestones = (Array.isArray(merged.milestones) ? merged.milestones : []).map((m) =>
                paid.has(m.id)
                  ? { ...m, status: 'paid', paidAt: paid.get(m.id).paidAt, stripeSessionId: paid.get(m.id).stripeSessionId }
                  : m
              )
              paid.forEach((m, mid) => {
                if (!merged.milestones.some((x) => x.id === mid)) merged.milestones.push(m)
              })
              return merged
            }
          }
          return incoming
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
    // Trigger a cloud-portal sync now (employees may use this; it only pushes
    // data that is already marked portal-visible).
    server.middlewares.use('/api/portal-sync', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }
      const result = await runPortalSync()
      sendJson(res, result.ok === false ? 502 : 200, result)
    })

    // -----------------------------------------------------------------------
    // CLIENT PORTAL: token-scoped endpoints, safe to expose over the tunnel.
    // -----------------------------------------------------------------------
    server.middlewares.use('/api/portal', async (req, res) => {
      const url = new URL(req.url, 'http://localhost')
      const route = url.pathname // '/api/portal' mount prefix already stripped
      try {
        if (req.method === 'GET' && (route === '/session' || route === '/messages')) {
          const client = portalClientByToken(url.searchParams.get('token'))
          if (!client) {
            sendJson(res, 401, { error: 'This portal link is invalid or has been disabled.' })
            return
          }
          if (route === '/messages') {
            sendJson(res, 200, { messages: portalMessagesFor(client.id) })
            return
          }
          const config = readHostConfig()
          sendJson(res, 200, {
            client: { name: client.name, company: client.company || '', email: client.email || '' },
            business: {
              companyName: config.companyName || 'QuoteFlow',
              businessDescription: config.businessDescription || '',
              companyLogo: config.companyLogo || '',
              email: config.email || '',
              phone: config.phone || '',
            },
            projects: portalProjects(client.id),
            messages: portalMessagesFor(client.id),
            aiEnabled: Boolean(config.openRouterKey && config.openRouterModel),
            paymentsEnabled: Boolean(config.stripeKey),
          })
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' })
          return
        }

        const body = JSON.parse((await readBody(req)) || '{}')
        const client = portalClientByToken(body.token)
        if (!client) {
          sendJson(res, 401, { error: 'This portal link is invalid or has been disabled.' })
          return
        }
        const config = readHostConfig()

        // POST /api/portal/message — client sends the team a message.
        if (route === '/message') {
          const text = String(body.text || '').trim().slice(0, 4000)
          if (!text) {
            sendJson(res, 400, { error: 'Message text is required.' })
            return
          }
          const messages = readCollection('portalMessages')
          const saved = {
            id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            clientId: client.id,
            from: 'client',
            text,
            timestamp: new Date().toISOString(),
            read: false,
          }
          messages.push(saved)
          writeCollection('portalMessages', messages)
          notifyOwner(config, `New portal message from ${client.name}`,
            `<p>${escapeHtml(text)}</p><p style="color:#718096">Reply from the Client Directory in QuoteFlow.</p>`)
          sendJson(res, 200, saved)
          return
        }

        // POST /api/portal/chat — AI assistant scoped to this client's data.
        if (route === '/chat') {
          if (!config.openRouterKey || !config.openRouterModel) {
            sendJson(res, 400, { error: 'The assistant is not available right now.' })
            return
          }
          const now = Date.now()
          const hits = (portalChatHits.get(client.portalToken) || []).filter((t) => now - t < 60 * 60 * 1000)
          if (hits.length >= PORTAL_CHAT_LIMIT) {
            sendJson(res, 429, { error: 'You have reached the assistant limit for this hour. Please try again later, or send us a message instead.' })
            return
          }
          hits.push(now)
          portalChatHits.set(client.portalToken, hits)

          const history = (Array.isArray(body.messages) ? body.messages : [])
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .slice(-16)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))

          // Photos are large data URLs — strip them from the prompt context.
          const projectContext = portalProjects(client.id).map(({ photos: _photos, ...rest }) => rest)
          const system = [
            `You are the client-facing assistant for ${config.companyName || 'our company'}.`,
            `You are chatting with ${client.name}${client.company ? ` (${client.company})` : ''}, one of our clients, inside their secure client portal.`,
            config.businessDescription ? `About the business: ${config.businessDescription}` : '',
            `The client's current project data (JSON): ${JSON.stringify(projectContext)}`,
            'Be friendly, professional, and concise. Only discuss this client\'s own projects and the company\'s services — never other clients or internal business details.',
            'You cannot make changes, commitments, quotes, or bookings. When the client needs action or a promise, tell them to use the Messages tab so the team is notified.',
          ].filter(Boolean).join('\n\n')

          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${(config.openRouterKey || '').trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.openRouterModel,
              messages: [{ role: 'system', content: system }, ...history],
            }),
          })
          const data = await orRes.json().catch(() => ({}))
          if (!orRes.ok) {
            sendJson(res, 502, { error: data.error?.message || 'The assistant is temporarily unavailable.' })
            return
          }
          sendJson(res, 200, { reply: data.choices?.[0]?.message?.content || '' })
          return
        }

        // POST /api/portal/checkout — Stripe Checkout for one milestone.
        if (route === '/checkout') {
          if (!config.stripeKey) {
            sendJson(res, 400, { error: 'Online payments are not enabled yet.' })
            return
          }
          const project = readCollection('projects').find((p) => p.id === body.projectId && p.clientId === client.id)
          const milestone = project ? (project.milestones || []).find((m) => m.id === body.milestoneId) : null
          if (!project || !milestone) {
            sendJson(res, 404, { error: 'Milestone not found.' })
            return
          }
          if (milestone.status === 'paid') {
            sendJson(res, 400, { error: 'This milestone is already paid.' })
            return
          }
          const amount = Number(milestone.amount)
          if (!Number.isFinite(amount) || amount <= 0) {
            sendJson(res, 400, { error: 'This milestone has no payable amount yet.' })
            return
          }

          // Send the client back to THIS portal (tunnel or localhost) after paying.
          const proto = req.headers['x-forwarded-proto'] || 'http'
          const portalUrl = `${proto}://${req.headers.host}/portal?token=${encodeURIComponent(client.portalToken)}`
          const form = new URLSearchParams()
          form.append('payment_method_types[0]', 'card')
          form.append('line_items[0][price_data][currency]', 'usd')
          form.append('line_items[0][price_data][product_data][name]', `${project.name} — ${milestone.name}`)
          form.append('line_items[0][price_data][unit_amount]', Math.round(amount * 100).toString())
          form.append('line_items[0][quantity]', '1')
          form.append('mode', 'payment')
          form.append('success_url', `${portalUrl}&paid_session={CHECKOUT_SESSION_ID}`)
          form.append('cancel_url', portalUrl)
          // Metadata lets verify-payment locate the milestone from the session
          // itself, so a forged sessionId can't mark someone else's work paid.
          form.append('metadata[projectId]', project.id)
          form.append('metadata[milestoneId]', milestone.id)
          form.append('metadata[clientId]', client.id)
          if (client.email) form.append('customer_email', client.email)

          const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.stripeKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
          })
          const data = await stripeRes.json()
          if (!stripeRes.ok) {
            sendJson(res, 502, { error: data.error?.message || 'Stripe error' })
            return
          }
          sendJson(res, 200, { url: data.url })
          return
        }

        // POST /api/portal/verify-payment — confirm a session with Stripe and
        // mark the milestone paid. No webhook needed: the success redirect
        // carries the session id and we re-check payment_status server-side.
        if (route === '/verify-payment') {
          if (!config.stripeKey) {
            sendJson(res, 400, { error: 'Payments are not enabled.' })
            return
          }
          const sessionId = String(body.sessionId || '')
          if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
            sendJson(res, 400, { error: 'Invalid session id.' })
            return
          }
          const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
            headers: { Authorization: `Bearer ${config.stripeKey}` },
          })
          const session = await stripeRes.json()
          if (!stripeRes.ok) {
            sendJson(res, 502, { error: session.error?.message || 'Stripe error' })
            return
          }
          const meta = session.metadata || {}
          if (meta.clientId !== client.id) {
            sendJson(res, 403, { error: 'This payment belongs to a different client.' })
            return
          }
          if (session.payment_status !== 'paid') {
            sendJson(res, 200, { paid: false })
            return
          }

          const projects = readCollection('projects')
          const project = projects.find((p) => p.id === meta.projectId)
          const milestone = project ? (project.milestones || []).find((m) => m.id === meta.milestoneId) : null
          if (project && milestone && milestone.status !== 'paid') {
            milestone.status = 'paid'
            milestone.paidAt = new Date().toISOString()
            milestone.stripeSessionId = sessionId
            project.logs = project.logs || []
            project.logs.push({
              id: `log-${Date.now()}-portal`,
              timestamp: new Date().toISOString(),
              message: `Client paid milestone "${milestone.name}" ($${(Number(milestone.amount) || 0).toFixed(2)}) through the portal.`,
            })
            writeCollection('projects', projects)
            notifyOwner(config, `Payment received: ${milestone.name}`,
              `<p><strong>${escapeHtml(client.name)}</strong> paid <strong>$${(Number(milestone.amount) || 0).toFixed(2)}</strong> for milestone <strong>${escapeHtml(milestone.name)}</strong> on project <strong>${escapeHtml(project.name)}</strong>.</p>`)
          }
          sendJson(res, 200, { paid: true, projectId: meta.projectId, milestoneId: meta.milestoneId })
          return
        }

        sendJson(res, 404, { error: 'Unknown portal endpoint.' })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/api/agent/url', async (req, res) => {
      try {
        const q = new URL(req.url, 'http://localhost').searchParams
        const url = q.get('url')
        if (!url) {
          sendJson(res, 400, { error: 'Missing url parameter.' })
          return
        }
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          }
        })
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
        const html = await response.text()
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 15000)
        sendJson(res, 200, { content: text })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    // -----------------------------------------------------------------------
    // AGENT RUNTIME: Local-only autonomous coding endpoints
    // -----------------------------------------------------------------------
    server.middlewares.use('/api/agent/fs', async (req, res) => {
      if (req.headers['cf-connecting-ip']) {
        sendJson(res, 403, { error: 'Agent endpoints are restricted to the local host machine.' })
        return
      }
      try {
        const body = JSON.parse((await readBody(req)) || '{}')
        const targetPath = path.resolve(process.cwd(), body.path)
        


        if (req.method === 'POST') {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true })
          fs.writeFileSync(targetPath, body.content || '', 'utf8')
          sendJson(res, 200, { success: true, path: targetPath })
        } else if (req.method === 'GET') {
          const q = new URL(req.url, 'http://localhost').searchParams
          const p = path.resolve(process.cwd(), q.get('path') || '')

          const content = fs.readFileSync(p, 'utf8')
          sendJson(res, 200, { content })
        } else {
          sendJson(res, 405, { error: 'Method not allowed' })
        }
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/api/agent/exec', async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
      if (req.headers['cf-connecting-ip']) {
        sendJson(res, 403, { error: 'Agent endpoints are restricted to the local host machine.' })
        return
      }
      try {
        const body = JSON.parse((await readBody(req)) || '{}')
        exec(body.command, { cwd: process.cwd() }, (error, stdout, stderr) => {
          sendJson(res, 200, { 
            stdout: stdout || '', 
            stderr: stderr || '', 
            error: error ? error.message : null 
          })
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    // SPAWN simply returns a 200 OK after acknowledging the prompt, while
    // actual long-running multi-agent loop orchestration happens here or in the client.
    // For now, we simulate spawning by returning an agent ID and letting the client
    // manage the background task state via OpenRouter calls.
    server.middlewares.use('/api/agent/spawn', async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
      if (req.headers['cf-connecting-ip']) return sendJson(res, 403, { error: 'Restricted' })
      try {
        const body = JSON.parse((await readBody(req)) || '{}')
        const agentId = 'ag-' + Date.now()
        // In a full implementation, the Node server would run the OpenRouter loop here.
        // We return success so the client can begin streaming the sub-agent task.
        sendJson(res, 200, { success: true, agentId, role: body.role })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })
  },
}

const injectHostKey = (configField) => (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    // Trim: a stray space/newline pasted into the key corrupts the header and
    // the provider rejects it as "Missing Authentication header".
    const key = (readHostConfig()[configField] || '').trim()
    proxyReq.removeHeader('authorization')
    if (key) proxyReq.setHeader('Authorization', `Bearer ${key}`)
  })
}

const removeOrigin = () => (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('Origin');
  });
}

export default defineConfig({
  plugins: [react(), hostConfigPlugin],
  server: {
    allowedHosts: true,
    watch: {
      ignored: ['**/quote-flow-data/**', '**/quote-flow-data', '**/.quote-flow-host-config.json', '**/*.log']
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
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        rewrite: (requestPath) => requestPath.replace(/^\/api\/ollama/, ''),
        configure: removeOrigin(),
      },
    },
  },
})
