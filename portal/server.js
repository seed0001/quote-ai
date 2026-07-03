import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OAuth2Client } from 'google-auth-library'
import {
  db,
  hashPassword,
  verifyPassword,
  createSession,
  sessionClient,
  destroySession,
  pruneExpiredSessions,
  createAdminSession,
  sessionAdmin,
  destroyAdminSession,
  getBusiness,
  setBusiness,
  projectsForClient,
  messagesForClient,
  getCatalog,
  replaceCatalog,
  getPosts,
  replacePosts,
} from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT) || 8787
const IS_PROD = Boolean(process.env.RAILWAY_ENVIRONMENT) || process.env.NODE_ENV === 'production'
const SYNC_SECRET = (process.env.SYNC_SECRET || '').trim()
const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || '').trim()
const OPENROUTER_KEY = (process.env.OPENROUTER_API_KEY || '').trim()
const AI_MODEL = (process.env.PORTAL_AI_MODEL || '').trim()
const CHAT_LIMIT_PER_HOUR = Number(process.env.CHAT_LIMIT_PER_HOUR) || 20
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim()
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

// Bootstrap the administrator account from env so a fresh deploy is never
// locked out. Set ADMIN_EMAIL + ADMIN_PASSWORD in Railway variables; the
// password follows the variable, so changing it there resets the login.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const existing = db.prepare('SELECT id FROM admins WHERE lower(email) = ?').get(ADMIN_EMAIL)
  if (existing) {
    db.prepare('UPDATE admins SET password_hash = ?, active = 1 WHERE id = ?')
      .run(hashPassword(ADMIN_PASSWORD), existing.id)
  } else {
    db.prepare('INSERT INTO admins (id, email, name, password_hash, google_enabled, active, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)')
      .run(`adm-${Date.now()}`, ADMIN_EMAIL, process.env.ADMIN_NAME || 'Administrator', hashPassword(ADMIN_PASSWORD), new Date().toISOString())
  }
}

const app = express()
app.set('trust proxy', 1) // Railway/Cloudflare sit in front; needed for req.ip + secure cookies
app.use(express.json({ limit: '12mb' }))

const newId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`

// ---- Cookie helpers (no cookie-parser dep needed) --------------------------
const readCookie = (req, name) => {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

const setSessionCookie = (res, token) => {
  const attrs = [
    `portal_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ]
  if (IS_PROD) attrs.push('Secure')
  res.setHeader('Set-Cookie', attrs.join('; '))
}

const setAdminCookie = (res, token) => {
  const attrs = [
    `portal_admin_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ]
  if (IS_PROD) attrs.push('Secure')
  res.setHeader('Set-Cookie', attrs.join('; '))
}

const clearSessionCookie = (res) => {
  res.setHeader('Set-Cookie', [
    'portal_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    'portal_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  ])
}

// ---- Rate limiting (in-memory) ---------------------------------------------
const hitBuckets = new Map()
const limited = (bucket, max, windowMs) => {
  const now = Date.now()
  const hits = (hitBuckets.get(bucket) || []).filter((t) => now - t < windowMs)
  if (hits.length >= max) {
    hitBuckets.set(bucket, hits)
    return true
  }
  hits.push(now)
  hitBuckets.set(bucket, hits)
  return false
}

// ---- Auth middleware --------------------------------------------------------
const requireClient = (req, res, next) => {
  const client = sessionClient(readCookie(req, 'portal_session'))
  if (!client) {
    res.status(401).json({ error: 'Not signed in.' })
    return
  }
  req.client = client
  next()
}

const requireSync = (req, res, next) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!SYNC_SECRET || !token || token.length !== SYNC_SECRET.length
    || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(SYNC_SECRET))) {
    res.status(401).json({ error: 'Invalid sync credentials.' })
    return
  }
  next()
}

// ============================================================================
// PUBLIC SITE (no auth) — marketing pages, service catalog, quote requests
// ============================================================================
app.get('/api/public/site', (_req, res) => {
  const business = getBusiness()
  res.json({
    business: {
      companyName: business.companyName || "Travis's Creations",
      businessDescription: business.businessDescription || '',
      email: business.email || '',
      phone: business.phone || '',
    },
    catalog: getCatalog(),
    posts: getPosts(),
  })
})

app.post('/api/public/lead', (req, res) => {
  if (limited(`lead:${req.ip}`, 5, 60 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many requests from this connection. Please try again later or email us directly.' })
    return
  }
  const name = String(req.body?.name || '').trim().slice(0, 200)
  const email = String(req.body?.email || '').trim().slice(0, 200)
  const phone = String(req.body?.phone || '').trim().slice(0, 60)
  const interest = String(req.body?.interest || '').trim().slice(0, 200)
  const message = String(req.body?.message || '').trim().slice(0, 4000)
  if (!name || (!email && !phone)) {
    res.status(400).json({ error: 'Please include your name and an email or phone number so we can reach you.' })
    return
  }
  // Selected catalog services: re-resolve every line server-side so a request
  // can never carry made-up items or tampered prices.
  const catalogById = new Map(getCatalog().map((item) => [item.id, item]))
  const items = (Array.isArray(req.body?.items) ? req.body.items.slice(0, 60) : [])
    .map((entry) => {
      const source = catalogById.get(String(entry?.id))
      if (!source) return null
      const qty = Math.min(Math.max(Math.round(Number(entry?.qty)) || 1, 1), 999)
      return { id: source.id, name: source.name, category: source.category, unit: source.unit, price: source.price, qty }
    })
    .filter(Boolean)
  db.prepare('INSERT INTO leads (id, name, email, phone, interest, message, items, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)')
    .run(newId('lead'), name, email, phone, interest, message, JSON.stringify(items), new Date().toISOString())
  res.json({ ok: true })
})

// ============================================================================
// CLIENT AUTH
// ============================================================================
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' })
    return
  }
  if (limited(`login:${req.ip}:${email}`, 8, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' })
    return
  }
  const admin = db.prepare('SELECT * FROM admins WHERE lower(email) = ? AND active = 1').get(email)
  if (admin && admin.password_hash && verifyPassword(password, admin.password_hash)) {
    pruneExpiredSessions()
    setAdminCookie(res, createAdminSession(admin.id))
    res.json({ ok: true, role: 'admin' })
    return
  }
  const client = db.prepare('SELECT * FROM clients WHERE lower(email) = ? AND active = 1').get(email)
  if (!client || !client.password_hash || !verifyPassword(password, client.password_hash)) {
    res.status(401).json({ error: 'Incorrect email or password.' })
    return
  }
  pruneExpiredSessions()
  setSessionCookie(res, createSession(client.id))
  res.json({ ok: true, role: 'client' })
})

app.post('/api/auth/logout', (req, res) => {
  destroySession(readCookie(req, 'portal_session'))
  destroyAdminSession(readCookie(req, 'portal_admin_session'))
  clearSessionCookie(res)
  res.json({ ok: true })
})

app.get('/api/auth/config', (_req, res) => {
  res.json({ googleEnabled: Boolean(GOOGLE_CLIENT_ID), googleClientId: GOOGLE_CLIENT_ID })
})

app.post('/api/auth/google', async (req, res) => {
  if (!googleClient) {
    res.status(400).json({ error: 'Google sign-in is not configured yet.' })
    return
  }
  const credential = String(req.body?.credential || '')
  if (!credential) {
    res.status(400).json({ error: 'Google did not return a sign-in credential.' })
    return
  }
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    const email = String(payload?.email || '').trim().toLowerCase()
    if (!payload?.email_verified || !email) {
      res.status(401).json({ error: 'Google could not verify this email address.' })
      return
    }
    const admin = db.prepare('SELECT * FROM admins WHERE lower(email) = ? AND active = 1 AND google_enabled = 1').get(email)
    if (!admin) {
      res.status(403).json({ error: 'This Google account is not approved for administrator access.' })
      return
    }
    pruneExpiredSessions()
    setAdminCookie(res, createAdminSession(admin.id))
    res.json({ ok: true, role: 'admin' })
  } catch {
    res.status(401).json({ error: 'Google sign-in could not be verified.' })
  }
})

// ============================================================================
// CLIENT-FACING API (session cookie required)
// ============================================================================
app.get('/api/session', (req, res) => {
  const business = getBusiness()
  const admin = sessionAdmin(readCookie(req, 'portal_admin_session'))
  if (admin) {
    const clients = db.prepare(`
      SELECT c.id, c.name, c.company, c.email, c.active, c.created_at,
        COUNT(DISTINCT p.id) AS project_count,
        COUNT(DISTINCT CASE WHEN m.sender = 'client' AND m.synced = 0 THEN m.id END) AS unread_messages
      FROM clients c
      LEFT JOIN projects p ON p.client_id = c.id
      LEFT JOIN messages m ON m.client_id = c.id
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE
    `).all()
    const projects = db.prepare('SELECT id, client_id, name, status, summary, start_date, end_date, updated_at FROM projects ORDER BY updated_at DESC').all()
    const recentMessages = db.prepare(`
      SELECT m.id, m.client_id, m.sender, m.text, m.created_at, c.name AS client_name
      FROM messages m LEFT JOIN clients c ON c.id = m.client_id
      ORDER BY m.created_at DESC LIMIT 20
    `).all()
    res.json({
      role: 'admin',
      admin,
      business,
      clients,
      projects,
      recentMessages,
      stats: {
        clients: clients.filter((client) => client.active).length,
        projects: projects.length,
        activeProjects: projects.filter((project) => project.status !== 'completed').length,
        unreadMessages: clients.reduce((sum, client) => sum + Number(client.unread_messages || 0), 0),
      },
    })
    return
  }

  const client = sessionClient(readCookie(req, 'portal_session'))
  if (!client) {
    res.status(401).json({ error: 'Not signed in.' })
    return
  }
  res.json({
    role: 'client',
    client: { name: client.name, company: client.company, email: client.email },
    business: {
      companyName: business.companyName || 'Client Portal',
      businessDescription: business.businessDescription || '',
      companyLogo: business.companyLogo || '',
      email: business.email || '',
      phone: business.phone || '',
    },
    projects: projectsForClient(client.id),
    messages: messagesForClient(client.id),
    aiEnabled: Boolean(OPENROUTER_KEY && AI_MODEL),
    paymentsEnabled: Boolean(STRIPE_KEY),
  })
})

app.get('/api/messages', requireClient, (req, res) => {
  res.json({ messages: messagesForClient(req.client.id) })
})

app.post('/api/messages', requireClient, (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 4000)
  if (!text) {
    res.status(400).json({ error: 'Message text is required.' })
    return
  }
  const message = {
    id: newId('pm'),
    client_id: req.client.id,
    sender: 'client',
    text,
    created_at: new Date().toISOString(),
  }
  db.prepare('INSERT INTO messages (id, client_id, sender, text, created_at, synced) VALUES (?, ?, ?, ?, ?, 0)')
    .run(message.id, message.client_id, message.sender, message.text, message.created_at)
  res.json({ id: message.id, sender: 'client', text, created_at: message.created_at })
})

// AI chat — the portal talks to OpenRouter directly with its own key.
app.post('/api/chat', requireClient, async (req, res) => {
  if (!OPENROUTER_KEY || !AI_MODEL) {
    res.status(400).json({ error: 'The assistant is not available right now.' })
    return
  }
  if (limited(`chat:${req.client.id}`, CHAT_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
    res.status(429).json({ error: 'You have reached the assistant limit for this hour. Please try again later, or send us a message instead.' })
    return
  }

  const history = (Array.isArray(req.body?.messages) ? req.body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))

  const business = getBusiness()
  // Photos are large data URLs — keep them out of the prompt.
  const projectContext = projectsForClient(req.client.id).map(({ photos: _photos, ...rest }) => rest)
  const system = [
    `You are the client-facing assistant for ${business.companyName || 'our company'}.`,
    `You are chatting with ${req.client.name}${req.client.company ? ` (${req.client.company})` : ''}, one of our clients, inside their secure client portal.`,
    business.businessDescription ? `About the business: ${business.businessDescription}` : '',
    `The client's current project data (JSON): ${JSON.stringify(projectContext)}`,
    'Be friendly, professional, and concise. Only discuss this client\'s own projects and the company\'s services — never other clients or internal business details.',
    'You cannot make changes, commitments, quotes, or bookings. When the client needs action or a promise, tell them to use the Messages tab so the team is notified.',
  ].filter(Boolean).join('\n\n')

  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role: 'system', content: system }, ...history] }),
    })
    const data = await orRes.json().catch(() => ({}))
    if (!orRes.ok) {
      res.status(502).json({ error: data.error?.message || 'The assistant is temporarily unavailable.' })
      return
    }
    res.json({ reply: data.choices?.[0]?.message?.content || '' })
  } catch (error) {
    res.status(502).json({ error: `Assistant error: ${error.message}` })
  }
})

// ---- Stripe milestone payments ----------------------------------------------
const findMilestone = (clientId, projectId, milestoneId) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND client_id = ?').get(projectId, clientId)
  if (!row) return {}
  let data = {}
  try { data = JSON.parse(row.data) } catch { return {} }
  const milestone = (data.milestones || []).find((m) => m.id === milestoneId)
  return { row, data, milestone }
}

app.post('/api/checkout', requireClient, async (req, res) => {
  if (!STRIPE_KEY) {
    res.status(400).json({ error: 'Online payments are not enabled yet.' })
    return
  }
  const { row, milestone } = findMilestone(req.client.id, String(req.body?.projectId || ''), String(req.body?.milestoneId || ''))
  if (!row || !milestone) {
    res.status(404).json({ error: 'Milestone not found.' })
    return
  }
  if (milestone.status === 'paid') {
    res.status(400).json({ error: 'This milestone is already paid.' })
    return
  }
  const amount = Number(milestone.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'This milestone has no payable amount yet.' })
    return
  }

  const proto = req.headers['x-forwarded-proto'] || 'http'
  const origin = `${proto}://${req.headers.host}`
  const form = new URLSearchParams()
  form.append('payment_method_types[0]', 'card')
  form.append('line_items[0][price_data][currency]', 'usd')
  form.append('line_items[0][price_data][product_data][name]', `${row.name} — ${milestone.name}`)
  form.append('line_items[0][price_data][unit_amount]', Math.round(amount * 100).toString())
  form.append('line_items[0][quantity]', '1')
  form.append('mode', 'payment')
  form.append('success_url', `${origin}/?paid_session={CHECKOUT_SESSION_ID}`)
  form.append('cancel_url', `${origin}/`)
  form.append('metadata[projectId]', row.id)
  form.append('metadata[milestoneId]', milestone.id)
  form.append('metadata[clientId]', req.client.id)
  if (req.client.email) form.append('customer_email', req.client.email)

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const data = await stripeRes.json()
    if (!stripeRes.ok) {
      res.status(502).json({ error: data.error?.message || 'Stripe error' })
      return
    }
    res.json({ url: data.url })
  } catch (error) {
    res.status(502).json({ error: `Stripe error: ${error.message}` })
  }
})

app.post('/api/verify-payment', requireClient, async (req, res) => {
  if (!STRIPE_KEY) {
    res.status(400).json({ error: 'Payments are not enabled.' })
    return
  }
  const sessionId = String(req.body?.sessionId || '')
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    res.status(400).json({ error: 'Invalid session id.' })
    return
  }
  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    })
    const session = await stripeRes.json()
    if (!stripeRes.ok) {
      res.status(502).json({ error: session.error?.message || 'Stripe error' })
      return
    }
    const meta = session.metadata || {}
    if (meta.clientId !== req.client.id) {
      res.status(403).json({ error: 'This payment belongs to a different client.' })
      return
    }
    if (session.payment_status !== 'paid') {
      res.json({ paid: false })
      return
    }

    const { row, data, milestone } = findMilestone(req.client.id, meta.projectId, meta.milestoneId)
    if (row && milestone && milestone.status !== 'paid') {
      milestone.status = 'paid'
      milestone.paidAt = new Date().toISOString()
      milestone.stripeSessionId = sessionId
      data.logs = data.logs || []
      data.logs.push({
        id: newId('log'),
        timestamp: new Date().toISOString(),
        message: `Milestone "${milestone.name}" ($${(Number(milestone.amount) || 0).toFixed(2)}) paid online.`,
      })
      db.prepare('UPDATE projects SET data = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(data), new Date().toISOString(), row.id)
      db.prepare('INSERT OR IGNORE INTO payments (id, client_id, project_id, milestone_id, amount, stripe_session, paid_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
        .run(newId('pay'), req.client.id, row.id, milestone.id, Number(milestone.amount) || 0, sessionId, milestone.paidAt)
    }
    res.json({ paid: true })
  } catch (error) {
    res.status(502).json({ error: `Stripe error: ${error.message}` })
  }
})

// ============================================================================
// HUB SYNC API (Bearer SYNC_SECRET). The hub PUSHES published data here and
// PULLS new messages/payments back — the portal never initiates connections.
// ============================================================================
app.post('/api/sync/publish', requireSync, (req, res) => {
  const { business, clients, projects, replies, catalog, posts } = req.body || {}
  const now = new Date().toISOString()
  const summary = { clients: 0, projects: 0, replies: 0, catalog: 0, posts: 0 }

  const tx = db.transaction(() => {
    if (business && typeof business === 'object') setBusiness(business)

    if (Array.isArray(catalog)) {
      replaceCatalog(catalog)
      summary.catalog = catalog.length
    }

    if (Array.isArray(posts)) {
      replacePosts(posts)
      summary.posts = posts.length
    }

    for (const c of Array.isArray(clients) ? clients : []) {
      if (!c?.id || !c?.email || !c?.name) continue
      const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(c.id)
      if (existing) {
        db.prepare('UPDATE clients SET name = ?, company = ?, email = ?, active = ? WHERE id = ?')
          .run(c.name, c.company || '', String(c.email).trim().toLowerCase(), c.active === false ? 0 : 1, c.id)
      } else {
        db.prepare('INSERT INTO clients (id, name, company, email, password_hash, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(c.id, c.name, c.company || '', String(c.email).trim().toLowerCase(), '', c.active === false ? 0 : 1, now)
      }
      if (c.password) {
        db.prepare('UPDATE clients SET password_hash = ? WHERE id = ?').run(hashPassword(String(c.password)), c.id)
        db.prepare('DELETE FROM sessions WHERE client_id = ?').run(c.id) // password change signs out old sessions
      }
      summary.clients += 1
    }

    for (const p of Array.isArray(projects) ? projects : []) {
      if (!p?.id || !p?.clientId || !p?.name) continue
      // The hub owns milestone payment state EXCEPT payments taken here that
      // the hub hasn't acknowledged yet — never let a publish un-pay those.
      const existing = db.prepare('SELECT data FROM projects WHERE id = ?').get(p.id)
      const incoming = {
        logs: p.logs || [],
        photos: p.photos || [],
        milestones: p.milestones || [],
        checklistProgress: p.checklistProgress || { total: 0, done: 0 },
      }
      if (existing) {
        const unacked = db.prepare('SELECT milestone_id, stripe_session, paid_at FROM payments WHERE project_id = ? AND synced = 0').all(p.id)
        for (const pay of unacked) {
          const m = incoming.milestones.find((x) => x.id === pay.milestone_id)
          if (m && m.status !== 'paid') {
            m.status = 'paid'
            m.paidAt = pay.paid_at
            m.stripeSessionId = pay.stripe_session
          }
        }
      }
      db.prepare(`
        INSERT INTO projects (id, client_id, name, status, summary, start_date, end_date, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          client_id = excluded.client_id, name = excluded.name, status = excluded.status,
          summary = excluded.summary, start_date = excluded.start_date, end_date = excluded.end_date,
          data = excluded.data, updated_at = excluded.updated_at
      `).run(p.id, p.clientId, p.name, p.status || 'lead', p.summary || '', p.startDate || '', p.endDate || '', JSON.stringify(incoming), now)
      summary.projects += 1
    }

    // Remove projects the hub no longer publishes (unlinked or portal-disabled
    // clients). Only when the hub sends the full project list flag.
    if (req.body?.fullProjectList && Array.isArray(projects)) {
      const keep = new Set(projects.map((p) => p.id))
      const all = db.prepare('SELECT id FROM projects').all()
      for (const row of all) {
        if (!keep.has(row.id)) db.prepare('DELETE FROM projects WHERE id = ?').run(row.id)
      }
    }

    for (const r of Array.isArray(replies) ? replies : []) {
      if (!r?.id || !r?.clientId || !r?.text) continue
      db.prepare('INSERT OR IGNORE INTO messages (id, client_id, sender, text, created_at, synced) VALUES (?, ?, ?, ?, ?, 1)')
        .run(r.id, r.clientId, 'business', String(r.text).slice(0, 4000), r.timestamp || now)
      summary.replies += 1
    }
  })
  tx()
  res.json({ ok: true, ...summary })
})

app.get('/api/sync/pull', requireSync, (req, res) => {
  res.json({
    messages: db.prepare("SELECT id, client_id AS clientId, text, created_at AS timestamp FROM messages WHERE sender = 'client' AND synced = 0 ORDER BY created_at ASC").all(),
    payments: db.prepare('SELECT id, client_id AS clientId, project_id AS projectId, milestone_id AS milestoneId, amount, stripe_session AS stripeSession, paid_at AS paidAt FROM payments WHERE synced = 0 ORDER BY paid_at ASC').all(),
    leads: db.prepare('SELECT id, name, email, phone, interest, message, items, created_at AS createdAt FROM leads WHERE synced = 0 ORDER BY created_at ASC').all()
      .map((lead) => {
        let items = []
        try { items = JSON.parse(lead.items) } catch { /* legacy lead without items */ }
        return { ...lead, items: Array.isArray(items) ? items : [] }
      }),
  })
})

app.post('/api/sync/ack', requireSync, (req, res) => {
  const messageIds = Array.isArray(req.body?.messageIds) ? req.body.messageIds : []
  const paymentIds = Array.isArray(req.body?.paymentIds) ? req.body.paymentIds : []
  const leadIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds : []
  const tx = db.transaction(() => {
    for (const id of messageIds) db.prepare('UPDATE messages SET synced = 1 WHERE id = ?').run(String(id))
    for (const id of paymentIds) db.prepare('UPDATE payments SET synced = 1 WHERE id = ?').run(String(id))
    for (const id of leadIds) db.prepare('UPDATE leads SET synced = 1 WHERE id = ?').run(String(id))
  })
  tx()
  res.json({ ok: true, acked: messageIds.length + paymentIds.length + leadIds.length })
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, syncConfigured: Boolean(SYNC_SECRET) })
})

// ---- Static frontend (production build) ------------------------------------
const DIST = path.join(__dirname, 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Portal server listening on port ${PORT}`)
  if (!SYNC_SECRET) console.warn('WARNING: SYNC_SECRET is not set — the hub cannot publish or pull until it is.')
  if (!fs.existsSync(DIST)) console.warn('No dist/ build found — API only. Run `npm run build` to serve the frontend.')
})
