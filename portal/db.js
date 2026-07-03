import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// On Railway, set DATA_DIR to the volume mount path (e.g. /data) so the
// database survives redeploys. Locally it defaults to ./data (gitignored).
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(path.join(DATA_DIR, 'portal.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,            -- matches the hub's client id
    name TEXT NOT NULL,
    company TEXT DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,            -- matches the hub's project id
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'lead',
    summary TEXT DEFAULT '',
    start_date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    data TEXT DEFAULT '{}',         -- JSON: logs, photos, milestones, checklistProgress
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    sender TEXT NOT NULL,           -- 'client' | 'business'
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0        -- client messages: picked up by the hub yet?
  );
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    milestone_id TEXT NOT NULL,
    amount REAL NOT NULL,
    stripe_session TEXT UNIQUE NOT NULL,
    paid_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS business (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS catalog (
    id TEXT PRIMARY KEY,            -- matches the hub's catalog item id
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    price REAL DEFAULT 0,
    description TEXT DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,            -- matches the hub's post id
    title TEXT NOT NULL,
    tag TEXT DEFAULT 'news',
    body TEXT DEFAULT '',
    date TEXT DEFAULT '',
    images TEXT DEFAULT '[]',       -- JSON array of { id, url }
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    interest TEXT DEFAULT '',
    message TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0        -- picked up by the hub yet?
  );
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    google_enabled INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`)

// ---- Passwords (scrypt, no external deps) --------------------------------
export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export const verifyPassword = (password, stored) => {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

// ---- Sessions -------------------------------------------------------------
const SESSION_DAYS = 30

export const createSession = (clientId) => {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  db.prepare('INSERT INTO sessions (token, client_id, expires_at) VALUES (?, ?, ?)').run(token, clientId, expiresAt)
  return token
}

export const sessionClient = (token) => {
  if (!token) return null
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
  if (!row) return null
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return null
  }
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND active = 1').get(row.client_id)
  return client || null
}

export const destroySession = (token) => {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export const pruneExpiredSessions = () => {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now())
}

export const createAdminSession = (adminId) => {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  db.prepare('INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(token, adminId, expiresAt)
  return token
}

export const sessionAdmin = (token) => {
  if (!token) return null
  const row = db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token)
  if (!row) return null
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token)
    return null
  }
  return db.prepare('SELECT id, email, name FROM admins WHERE id = ? AND active = 1').get(row.admin_id) || null
}

export const destroyAdminSession = (token) => {
  if (token) db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token)
}

// ---- Business info (published by the hub) ---------------------------------
export const getBusiness = () => {
  const rows = db.prepare('SELECT key, value FROM business').all()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export const setBusiness = (entries) => {
  const upsert = db.prepare('INSERT INTO business (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  const run = db.transaction((pairs) => {
    for (const [key, value] of pairs) upsert.run(key, String(value ?? ''))
  })
  run(Object.entries(entries))
}

// ---- Client-visible data ---------------------------------------------------
export const projectsForClient = (clientId) =>
  db.prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY updated_at DESC').all(clientId).map((p) => {
    let data = {}
    try { data = JSON.parse(p.data) } catch { /* corrupt row — render without extras */ }
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      summary: p.summary,
      startDate: p.start_date,
      endDate: p.end_date,
      logs: data.logs || [],
      photos: data.photos || [],
      milestones: data.milestones || [],
      checklistProgress: data.checklistProgress || { total: 0, done: 0 },
    }
  })

export const messagesForClient = (clientId) =>
  db.prepare('SELECT id, sender, text, created_at FROM messages WHERE client_id = ? ORDER BY created_at ASC').all(clientId)

// ---- Public catalog (published by the hub) ---------------------------------
export const getCatalog = () =>
  db.prepare('SELECT id, name, category, unit, price, description FROM catalog ORDER BY category COLLATE NOCASE, name COLLATE NOCASE').all()

// ---- Website posts (published by the hub) ----------------------------------
export const getPosts = () =>
  db.prepare('SELECT id, title, tag, body, date, images FROM posts ORDER BY date DESC, updated_at DESC').all().map((p) => {
    let images = []
    try { images = JSON.parse(p.images) } catch { /* render without images */ }
    return { ...p, images: Array.isArray(images) ? images : [] }
  })

export const replacePosts = (posts) => {
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM posts').run()
    const insert = db.prepare('INSERT INTO posts (id, title, tag, body, date, images, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const post of posts) {
      if (!post?.id || !post?.title) continue
      insert.run(post.id, post.title, post.tag || 'news', post.body || '', post.date || '', JSON.stringify(post.images || []), now)
    }
  })
  tx()
}

// The hub's catalog is the source of truth — each publish replaces the set.
export const replaceCatalog = (items) => {
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM catalog').run()
    const insert = db.prepare('INSERT INTO catalog (id, name, category, unit, price, description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const item of items) {
      if (!item?.id || !item?.name) continue
      insert.run(item.id, item.name, item.category || '', item.unit || '', Number(item.price) || 0, item.description || '', now)
    }
  })
  tx()
}
