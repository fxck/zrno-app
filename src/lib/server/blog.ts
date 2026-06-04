import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth'
import { getPool } from '../db'
import { ensureDb } from '../migrate'
import { indexPost, removeFromIndex } from './search'

// IMPORTANT: this module is imported by route loaders and runs on the server.
// It MUST NOT import any Tiptap / ProseMirror code (those touch the DOM).

export type PostStatus = 'draft' | 'published'

export type Post = {
  id: string
  title: string
  slug: string
  excerpt: string
  content_html: string
  cover_image_url: string | null
  status: PostStatus
  created_at: string
  updated_at: string
  published_at: string | null
}

// Lighter shape for list views (no full body HTML).
export type PostListItem = Omit<Post, 'content_html'>

const LIST_COLUMNS =
  'id, title, slug, excerpt, cover_image_url, status, created_at, updated_at, published_at'
const FULL_COLUMNS =
  'id, title, slug, excerpt, content_html, cover_image_url, status, created_at, updated_at, published_at'

// --- helpers ---------------------------------------------------------------

async function requireSession() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user ? session : null
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      // strip accents/diacritics (handles Czech etc.)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'post'
  )
}

// Ensure a slug is unique across posts, excluding the row being updated.
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base)
  let candidate = root
  let n = 1
  // Loop until no other row owns the candidate slug.
  // (Small admin dataset — a handful of queries at most.)
  while (true) {
    const res = await getPool().query(
      'SELECT 1 FROM posts WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2) LIMIT 1',
      [candidate, excludeId ?? null],
    )
    if (!res.rowCount) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
}

// --- public (no auth) ------------------------------------------------------

export const listPublishedPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PostListItem[]> => {
    await ensureDb()
    const res = await getPool().query(
      `SELECT ${LIST_COLUMNS} FROM posts
       WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST, created_at DESC`,
    )
    return res.rows as PostListItem[]
  },
)

export const getPublishedPostBySlug = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<Post | null> => {
    await ensureDb()
    const res = await getPool().query(
      `SELECT ${FULL_COLUMNS} FROM posts
       WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [slug],
    )
    return (res.rows[0] as Post) ?? null
  })

// --- admin (auth-gated) ----------------------------------------------------

export const listAllPosts = createServerFn({ method: 'GET' }).handler(async () => {
  await ensureDb()
  const session = await requireSession()
  if (!session) return { authed: false as const }
  const res = await getPool().query(
    `SELECT ${LIST_COLUMNS} FROM posts ORDER BY updated_at DESC`,
  )
  return { authed: true as const, posts: res.rows as PostListItem[] }
})

export const getPostById = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    await ensureDb()
    const session = await requireSession()
    if (!session) return { authed: false as const }
    const res = await getPool().query(
      `SELECT ${FULL_COLUMNS} FROM posts WHERE id = $1 LIMIT 1`,
      [id],
    )
    return { authed: true as const, post: (res.rows[0] as Post) ?? null }
  })

export type SavePostInput = {
  id?: string | null
  title: string
  slug?: string
  excerpt?: string
  content_html?: string
  cover_image_url?: string | null
  // 'publish' forces published + stamps published_at; otherwise status is kept/draft.
  action?: 'draft' | 'publish'
}

export const savePost = createServerFn({ method: 'POST' })
  .inputValidator((data: SavePostInput) => data)
  .handler(async ({ data }) => {
    await ensureDb()
    const session = await requireSession()
    if (!session) return { authed: false as const }

    const title = (data.title ?? '').trim() || 'Untitled'
    const excerpt = (data.excerpt ?? '').trim()
    const contentHtml = data.content_html ?? ''
    const cover = (data.cover_image_url ?? '').trim() || null
    const publish = data.action === 'publish'

    if (data.id) {
      // Update existing post.
      const existing = await getPool().query(
        'SELECT id, status, published_at FROM posts WHERE id = $1 LIMIT 1',
        [data.id],
      )
      if (!existing.rowCount) {
        return { authed: true as const, ok: false as const, error: 'Post not found.' }
      }
      const row = existing.rows[0] as { status: PostStatus; published_at: string | null }
      const desiredSlug = (data.slug ?? '').trim() || title
      const slug = await uniqueSlug(desiredSlug, data.id)
      const status: PostStatus = publish
        ? 'published'
        : data.action === 'draft'
          ? 'draft'
          : row.status
      // Stamp published_at on first publish; clear it when reverting to draft.
      const publishedAtExpr =
        status === 'published'
          ? row.published_at
            ? row.published_at
            : new Date()
          : null

      const upd = await getPool().query(
        `UPDATE posts
         SET title=$1, slug=$2, excerpt=$3, content_html=$4, cover_image_url=$5,
             status=$6, published_at=$7, updated_at=now()
         WHERE id=$8
         RETURNING id, slug, status`,
        [title, slug, excerpt, contentHtml, cover, status, publishedAtExpr, data.id],
      )
      const r = upd.rows[0]
      void indexPost(r.id) // best-effort: keep search in sync
      return { authed: true as const, ok: true as const, id: r.id, slug: r.slug, status: r.status }
    }

    // Create new post.
    const slug = await uniqueSlug((data.slug ?? '').trim() || title)
    const status: PostStatus = publish ? 'published' : 'draft'
    const ins = await getPool().query(
      `INSERT INTO posts(title, slug, excerpt, content_html, cover_image_url, status, published_at)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, slug, status`,
      [title, slug, excerpt, contentHtml, cover, status, status === 'published' ? new Date() : null],
    )
    const r = ins.rows[0]
    void indexPost(r.id) // best-effort: keep search in sync
    return { authed: true as const, ok: true as const, id: r.id, slug: r.slug, status: r.status }
  })

export const setPostStatus = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string; status: PostStatus }) => data)
  .handler(async ({ data }) => {
    await ensureDb()
    const session = await requireSession()
    if (!session) return { authed: false as const }
    const publish = data.status === 'published'
    // On publish, set published_at only if not already set.
    await getPool().query(
      `UPDATE posts
       SET status=$1,
           published_at = CASE
             WHEN $2 = true THEN COALESCE(published_at, now())
             ELSE NULL
           END,
           updated_at = now()
       WHERE id=$3`,
      [data.status, publish, data.id],
    )
    void indexPost(data.id) // reflect new status in search
    return { authed: true as const, ok: true as const }
  })

export const deletePost = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await ensureDb()
    const session = await requireSession()
    if (!session) return { authed: false as const }
    await getPool().query('DELETE FROM posts WHERE id = $1', [data.id])
    void removeFromIndex('posts', data.id) // drop it from search too
    return { authed: true as const, ok: true as const }
  })
