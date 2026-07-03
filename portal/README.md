# QuoteFlow Client Portal

Standalone customer-facing portal, designed to run 24/7 in the cloud (Railway)
while the main QuoteFlow hub keeps running on the business computer. The hub
pushes published project data here and pulls back client messages and payments
— the portal never connects *into* the hub.

## Stack

- **Server**: Express + better-sqlite3 (single-file DB, no external database service)
- **Frontend**: React + Vite, built to `dist/` and served by the same Express process
- **Auth**: email + password per client, session cookie (30 days)

## Run locally

```bash
cd portal
npm install

# terminal 1 — API server on :8787
npm run dev:api

# terminal 2 — frontend with hot reload on :5273 (proxies /api to :8787)
npm run dev
```

Open http://localhost:5273 and sign in with a client account published from
the QuoteFlow hub.

Production-style run (what Railway does):

```bash
npm run build && npm start    # everything on :8787
```

## Environment variables

See `.env.example`. The important ones:

| Variable | Purpose |
|---|---|
| `SYNC_SECRET` | Shared secret the hub uses to publish/pull. Required for sync. |
| `DATA_DIR` | SQLite location. On Railway: the volume mount path (e.g. `/data`). |
| `STRIPE_SECRET_KEY` | Enables milestone payments. |
| `OPENROUTER_API_KEY` + `PORTAL_AI_MODEL` | Enables the client AI chat. |

## Deploy on Railway

1. Push this repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → select the repo.
3. In the service **Settings**:
   - **Root Directory**: `portal`
   - **Build Command**: `npm run build` (usually auto-detected)
   - **Start Command**: `npm start`
   - Optional: **Watch Paths** = `portal/**` so hub-only commits don't redeploy the portal.
4. **Add a Volume** to the service, mount path `/data`.
5. **Variables**: `DATA_DIR=/data`, `SYNC_SECRET=<generated>`, plus Stripe/OpenRouter keys as desired.
6. **Settings → Networking → Generate Domain** for the permanent public URL.
7. In the hub's System Settings, set the Portal URL to that domain and paste the
   same `SYNC_SECRET`, then hit "Sync now".

## Hub sync API

All under `/api/sync/*`, authenticated with `Authorization: Bearer <SYNC_SECRET>`:

- `POST /api/sync/publish` — upsert business info, client accounts (optionally
  with a new password), published project snapshots, and owner replies.
- `GET /api/sync/pull` — returns client messages and payments the hub hasn't
  acknowledged yet.
- `POST /api/sync/ack` — `{ messageIds, paymentIds }` marks them as processed.
