import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { savePost, type Post } from '../lib/server/blog'
import { uploadImageFile, ACCEPT_IMAGE } from '../lib/upload-client'
import { Button } from './ui/button'
import { Input, Label } from './ui/input'

// Lazy-load the Tiptap editor: it (and all ProseMirror code) is then split into
// a client-only chunk and never pulled into the SSR/loader graph. Combined with
// `immediatelyRender:false`, this keeps Tiptap fully off the server.
const JournalEditor = lazy(() => import('./journal-editor'))

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || ''
  )
}

type Props = {
  // Existing post when editing; undefined when creating.
  post?: Post | null
}

export default function JournalPostForm({ post }: Props) {
  const router = useRouter()
  const isEdit = Boolean(post?.id)

  const [title, setTitle] = useState(post?.title ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [cover, setCover] = useState(post?.cover_image_url ?? '')
  const [html, setHtml] = useState(post?.content_html ?? '')

  const [busy, setBusy] = useState<null | 'draft' | 'publish'>(null)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<string>('')

  // Cover image upload → object storage.
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverErr, setCoverErr] = useState('')

  async function onCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked later
    if (!file) return
    setCoverErr('')
    setCoverBusy(true)
    try {
      setCover(await uploadImageFile(file, 'cover'))
    } catch (err: any) {
      setCoverErr(err.message || 'Upload failed.')
    } finally {
      setCoverBusy(false)
    }
  }

  // Auto-suggest slug from title until the user edits the slug by hand.
  const slugTouched = useRef(Boolean(post?.slug))
  useEffect(() => {
    if (slugTouched.current) return
    setSlug(slugify(title))
  }, [title])

  async function save(action: 'draft' | 'publish') {
    if (!title.trim()) {
      setError('A title is required.')
      return
    }
    setError('')
    setBusy(action)
    const res = await savePost({
      data: {
        id: post?.id ?? null,
        title,
        slug: slug.trim() || undefined,
        excerpt,
        content_html: html,
        cover_image_url: cover.trim() || null,
        action,
      },
    })
    setBusy(null)

    if (!res.authed) {
      router.navigate({ to: '/admin' })
      return
    }
    if (!res.ok) {
      setError(res.error ?? 'Could not save.')
      return
    }

    // New post → move to its edit URL so subsequent saves update in place.
    if (!isEdit) {
      router.navigate({ to: '/admin/journal/$id/edit', params: { id: res.id } })
      return
    }
    // Reflect any server-side slug change + invalidate the list.
    setSlug(res.slug)
    setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    router.invalidate()
  }

  return (
    <div className="min-h-screen bg-espresso text-cream font-body">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 md:px-12 py-4 border-b border-muted/15 bg-espresso/95 backdrop-blur">
        <div className="flex items-baseline gap-4 min-w-0">
          <Link to="/admin/journal" className="font-mono text-[11px] tracking-[0.18em] uppercase text-taupe hover:text-cream transition-colors whitespace-nowrap">
            ← Journal
          </Link>
          <span className="font-mono text-[11px] text-muted truncate">
            {isEdit ? `Editing · ${post?.status}` : 'New post'}
            {savedAt && <span className="text-amber"> · saved {savedAt}</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => save('draft')}
          >
            {busy === 'draft' ? 'Saving…' : 'Save draft'}
          </Button>
          <Button size="sm" disabled={busy !== null} onClick={() => save('publish')}>
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </header>

      <main className="px-6 md:px-12 py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {error && (
            <p className="bg-red-500/10 text-red-400 text-sm px-4 py-3 border border-red-500/20">
              {error}
            </p>
          )}

          {/* Title — big, like the published headline. */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            rows={1}
            className="w-full resize-none bg-transparent font-display text-4xl md:text-5xl leading-[0.98] text-cream placeholder:text-muted outline-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  slugTouched.current = true
                  setSlug(e.target.value)
                }}
                onBlur={(e) => setSlug(slugify(e.target.value))}
                placeholder="auto-from-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cover">Cover image</Label>
              <input
                ref={coverInputRef}
                type="file"
                accept={ACCEPT_IMAGE}
                className="hidden"
                onChange={onCoverFile}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={coverBusy}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverBusy ? 'Uploading…' : cover ? 'Replace' : 'Upload image'}
                </Button>
                {cover && !coverBusy && (
                  <button
                    type="button"
                    onClick={() => setCover('')}
                    className="font-mono text-[11px] tracking-[0.12em] text-muted hover:text-cream transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <Input
                id="cover"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder="…or paste an image URL"
              />
              {coverErr && <p className="text-red-400 text-xs">{coverErr}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="excerpt">Excerpt</Label>
            <textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="One or two sentences for the journal index."
              className="w-full resize-y bg-elevated px-4 py-3 text-sm text-cream placeholder:text-muted outline-none focus:ring-2 focus:ring-amber/50"
            />
          </div>

          {cover.trim() && (
            <img
              key={cover}
              src={cover}
              alt="Cover preview"
              className="w-full h-auto border border-muted/20"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
        </div>

        {/* The editor canvas. Same `.prose-article` column/typography as live. */}
        <div className="mt-10 border-t border-muted/15 pt-10">
          <Suspense
            fallback={
              <div className="max-w-[680px] mx-auto text-taupe font-mono text-xs tracking-widest uppercase py-10">
                Loading editor…
              </div>
            }
          >
            <JournalEditor value={html} onChange={setHtml} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
