import { getPool } from '../db'
import { ensureDb } from '../migrate'

// NOTE: server-only module. It is imported exclusively by other server code —
// the write paths (lib/server, api routes) and the /api/admin/* search route
// handlers. The browser talks to those API routes over fetch and never imports
// this file, so better-auth / pg / the meili client stay out of the client
// bundle. (Importing this from a client component pulls kysely into the client
// build and breaks rolldown — see /api/admin/search.ts.)

/* ------------------------------------------------------------------ *
 * Meilisearch — back-office search.
 *
 * Powers the ⌘K command palette: one typo-tolerant, ranked search
 * across orders, subscribers and journal posts. All access is
 * server-side and admin-gated; the master key NEVER reaches the
 * browser. If Meilisearch isn't wired (env missing) every function
 * degrades to a no-op so the rest of the app is unaffected.
 *
 * Sync model: write paths fire single-document upserts (best-effort,
 * never blocking the user's write — see indexOrder/indexSubscriber/
 * indexPost). `ensureSearch()` lazily configures the indexes once per
 * process and backfills any that are empty, so a fresh Meilisearch or
 * a missed write self-heals on the next search. A manual reindex is
 * also exposed for the palette's "Reindex" affordance.
 * ------------------------------------------------------------------ */

// Read env lazily inside functions (never at module top level) — this module
// is also pulled into the client bundle as RPC stubs, where `process` is absent.
function cfg() {
  return { host: process.env.MEILI_HOST, key: process.env.MEILI_MASTER_KEY }
}

export function searchEnabled() {
  const { host, key } = cfg()
  return Boolean(host && key)
}

type IndexName = 'orders' | 'subscribers' | 'posts'

async function meili(path: string, init?: RequestInit): Promise<any> {
  const { host, key } = cfg()
  const res = await fetch(`${host}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(
      `meili ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 200)}`,
    )
  }
  return body
}

// Meilisearch ops are async tasks; wait for the important ones (index
// creation, settings) so a follow-up doesn't race a half-built index.
async function waitTask(taskUid: number, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const t = await meili(`/tasks/${taskUid}`)
    if (t.status === 'succeeded') return
    if (t.status === 'failed' || t.status === 'canceled') {
      throw new Error(`meili task ${taskUid} ${t.status}: ${JSON.stringify(t.error)}`)
    }
    await new Promise((r) => setTimeout(r, 150))
  }
}

const SETTINGS: Record<IndexName, Record<string, unknown>> = {
  orders: {
    searchableAttributes: ['short_id', 'customer_name', 'email', 'items_text', 'status'],
    filterableAttributes: ['status', 'delivered'],
    sortableAttributes: ['created_at_ts', 'total'],
  },
  subscribers: {
    searchableAttributes: ['email'],
    sortableAttributes: ['created_at_ts'],
  },
  posts: {
    searchableAttributes: ['title', 'excerpt', 'slug', 'body_text'],
    filterableAttributes: ['status'],
    sortableAttributes: ['updated_at_ts'],
  },
}

// --- document shaping -------------------------------------------------------

function stripHtml(html: string | null): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)
}

function orderDoc(o: any) {
  const items: { name: string; qty: number }[] = Array.isArray(o.items) ? o.items : []
  return {
    id: o.id,
    type: 'order',
    short_id: String(o.id).slice(0, 8),
    customer_name: o.customer_name,
    email: o.email,
    items_text: items.map((i) => `${i.qty}× ${i.name}`).join(', '),
    status: o.status,
    delivered: Boolean(o.delivered_at),
    total: o.total,
    currency: o.currency,
    created_at: o.created_at,
    created_at_ts: o.created_at ? new Date(o.created_at).getTime() : 0,
  }
}

function subscriberDoc(s: any) {
  return {
    id: s.id,
    type: 'subscriber',
    email: s.email,
    created_at: s.created_at,
    created_at_ts: s.created_at ? new Date(s.created_at).getTime() : 0,
  }
}

function postDoc(p: any) {
  return {
    id: p.id,
    type: 'post',
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    body_text: stripHtml(p.content_html ?? p.body_text ?? null),
    status: p.status,
    updated_at: p.updated_at,
    updated_at_ts: p.updated_at ? new Date(p.updated_at).getTime() : 0,
  }
}

// --- index lifecycle --------------------------------------------------------

let configured: Promise<void> | null = null

// Once per process: create the three indexes (+ settings) if missing, then
// backfill any that are empty. Cheap to re-await; the heavy work runs once.
export function ensureSearch(): Promise<void> {
  if (!searchEnabled()) return Promise.resolve()
  if (!configured) {
    configured = configure().catch((e) => {
      configured = null // let a later request retry if Meilisearch was briefly down
      throw e
    })
  }
  return configured
}

async function configure() {
  for (const name of Object.keys(SETTINGS) as IndexName[]) {
    let exists = true
    try {
      await meili(`/indexes/${name}`)
    } catch {
      exists = false
    }
    if (!exists) {
      const t = await meili('/indexes', {
        method: 'POST',
        body: JSON.stringify({ uid: name, primaryKey: 'id' }),
      })
      await waitTask(t.taskUid)
    }
    const st = await meili(`/indexes/${name}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(SETTINGS[name]),
    })
    await waitTask(st.taskUid)

    const stats = await meili(`/indexes/${name}/stats`)
    if (!stats.numberOfDocuments) await backfill(name)
  }
}

async function backfill(name: IndexName) {
  await ensureDb()
  let docs: any[] = []
  if (name === 'orders') {
    const r = await getPool().query(
      `SELECT id, customer_name, email, items, total, currency, status, created_at, delivered_at
       FROM orders ORDER BY created_at DESC LIMIT 5000`,
    )
    docs = r.rows.map(orderDoc)
  } else if (name === 'subscribers') {
    const r = await getPool().query(
      `SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC LIMIT 10000`,
    )
    docs = r.rows.map(subscriberDoc)
  } else {
    const r = await getPool().query(
      `SELECT id, title, slug, excerpt, content_html, status, updated_at FROM posts`,
    )
    docs = r.rows.map(postDoc)
  }
  if (docs.length) {
    const t = await meili(`/indexes/${name}/documents`, {
      method: 'PUT',
      body: JSON.stringify(docs),
    })
    await waitTask(t.taskUid)
  }
}

// --- write-path sync (best-effort, never throws to the caller) --------------

async function upsert(name: IndexName, doc: unknown) {
  await ensureSearch()
  await meili(`/indexes/${name}/documents`, {
    method: 'PUT',
    body: JSON.stringify([doc]),
  })
}

/** Fire-and-forget index refresh for one order. Safe to `void`. */
export async function indexOrder(id: string) {
  if (!searchEnabled()) return
  try {
    const r = await getPool().query(
      `SELECT id, customer_name, email, items, total, currency, status, created_at, delivered_at
       FROM orders WHERE id = $1 LIMIT 1`,
      [id],
    )
    if (r.rowCount) await upsert('orders', orderDoc(r.rows[0]))
  } catch (e) {
    console.error('[search] indexOrder failed', e)
  }
}

export async function indexSubscriberByEmail(email: string) {
  if (!searchEnabled()) return
  try {
    const r = await getPool().query(
      `SELECT id, email, created_at FROM subscribers WHERE email = $1 LIMIT 1`,
      [email],
    )
    if (r.rowCount) await upsert('subscribers', subscriberDoc(r.rows[0]))
  } catch (e) {
    console.error('[search] indexSubscriber failed', e)
  }
}

export async function indexPost(id: string) {
  if (!searchEnabled()) return
  try {
    const r = await getPool().query(
      `SELECT id, title, slug, excerpt, content_html, status, updated_at FROM posts WHERE id = $1 LIMIT 1`,
      [id],
    )
    if (r.rowCount) await upsert('posts', postDoc(r.rows[0]))
  } catch (e) {
    console.error('[search] indexPost failed', e)
  }
}

export async function removeFromIndex(name: IndexName, id: string) {
  if (!searchEnabled()) return
  try {
    await meili(`/indexes/${name}/documents/${id}`, { method: 'DELETE' })
  } catch (e) {
    console.error('[search] removeFromIndex failed', e)
  }
}

// --- query ------------------------------------------------------------------
// Auth is enforced by the calling API route handler, not here.

export type SearchHit = {
  id: string
  type: 'order' | 'subscriber' | 'post'
  title: string
  subtitle: string
  url: string
  badge?: string
}
export type SearchGroup = { type: string; label: string; hits: SearchHit[] }

function mapHit(indexUid: string, h: any): SearchHit {
  if (indexUid === 'orders') {
    return {
      id: h.id,
      type: 'order',
      title: `#${h.short_id} · ${h.customer_name}`,
      subtitle: `${h.items_text || '—'} — ${h.total} ${h.currency}`,
      url: `/o/${h.id}`,
      badge: h.delivered ? 'delivered' : h.status,
    }
  }
  if (indexUid === 'subscribers') {
    return {
      id: h.id,
      type: 'subscriber',
      title: h.email,
      subtitle: 'Newsletter subscriber',
      url: '/admin/subscribers',
    }
  }
  return {
    id: h.id,
    type: 'post',
    title: h.title,
    subtitle: `/${h.slug}`,
    url: `/admin/journal/${h.id}/edit`,
    badge: h.status,
  }
}

const GROUP_LABEL: Record<string, string> = {
  orders: 'Orders',
  subscribers: 'Subscribers',
  posts: 'Journal',
}

export async function searchAdmin(
  q: string,
): Promise<{ enabled: boolean; q: string; groups: SearchGroup[] }> {
  const query = (q ?? '').trim()
  if (!searchEnabled()) return { enabled: false, q: query, groups: [] }
  if (!query) return { enabled: true, q: query, groups: [] }

  await ensureSearch()
  const { results } = await meili('/multi-search', {
    method: 'POST',
    body: JSON.stringify({
      queries: (['orders', 'subscribers', 'posts'] as IndexName[]).map((indexUid) => ({
        indexUid,
        q: query,
        limit: 6,
      })),
    }),
  })

  const groups: SearchGroup[] = []
  for (const r of results as any[]) {
    if (!r.hits?.length) continue
    groups.push({
      type: r.indexUid,
      label: GROUP_LABEL[r.indexUid] ?? r.indexUid,
      hits: r.hits.map((h: any) => mapHit(r.indexUid, h)),
    })
  }
  return { enabled: true, q: query, groups }
}

// Full rebuild from Postgres — the palette's "Reindex" safety valve.
export async function reindexAllNow(): Promise<{
  enabled: boolean
  counts?: Record<string, number>
}> {
  if (!searchEnabled()) return { enabled: false }
  await ensureSearch()
  const counts: Record<string, number> = {}
  for (const name of Object.keys(SETTINGS) as IndexName[]) {
    // Drop then refill so deletions in Postgres are reflected.
    const del = await meili(`/indexes/${name}/documents`, { method: 'DELETE' })
    await waitTask(del.taskUid)
    await backfill(name)
    const stats = await meili(`/indexes/${name}/stats`)
    counts[name] = stats.numberOfDocuments ?? 0
  }
  return { enabled: true, counts }
}
