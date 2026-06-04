import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { savePost, type Post } from '../lib/server/blog'
import { ImagePlus } from 'lucide-react'
import { uploadImageFile, ACCEPT_IMAGE } from '../lib/upload-client'
import { AdminShell } from './admin-shell'
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
    <AdminShell
      actions={
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted truncate hidden sm:inline">
            {isEdit ? `Editing · ${post?.status}` : 'New post'}
            {savedAt && <span className="text-amber"> · saved {savedAt}</span>}
          </span>
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
      }
    >
      <div className="max-w-3xl mx-auto space-y-10">
          {error && (
            <p className="rounded-md bg-red-500/10 text-red-400 text-sm px-4 py-3 border border-red-500/20">
              {error}
            </p>
          )}

          {/* Title — big, like the published headline. */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            rows={1}
            className="w-full resize-none bg-transparent font-display text-4xl md:text-5xl leading-[1.04] text-cream placeholder:text-muted/50 outline-none"
          />

          {/* Cover — a full-width banner, like the published article header. */}
          <div className="space-y-3">
            <Label>Cover image</Label>
            <input
              ref={coverInputRef}
              type="file"
              accept={ACCEPT_IMAGE}
              className="hidden"
              onChange={onCoverFile}
            />
            {cover ? (
              <div className="group relative aspect-[3/1] w-full overflow-hidden rounded-lg border border-muted/15 bg-elevated">
                <img
                  key={cover}
                  src={cover}
                  alt="Cover preview"
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.style.opacity = '0.15')}
                />
                <div className="absolute inset-0 flex items-center justify-center gap-3 bg-espresso/70 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={coverBusy}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {coverBusy ? 'Uploading…' : 'Replace'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCover('')}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverBusy}
                className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-muted/30 bg-elevated/30 text-taupe transition-colors hover:border-amber/50 hover:text-cream disabled:opacity-60"
              >
                <ImagePlus size={26} strokeWidth={1.5} />
                <span className="font-mono text-[11px] tracking-[0.18em]">
                  {coverBusy ? 'UPLOADING…' : 'UPLOAD COVER IMAGE'}
                </span>
                <span className="text-[11px] text-muted">JPEG · PNG · WebP — up to 8 MB</span>
              </button>
            )}
            {coverErr && <p className="text-red-400 text-xs">{coverErr}</p>}
          </div>

          {/* Slug + excerpt — roomy, side by side, no cramped box. */}
          <div className="grid gap-8 sm:grid-cols-2 items-start">
            <div className="space-y-2.5">
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
            <div className="space-y-2.5">
              <Label htmlFor="excerpt">Excerpt</Label>
              <textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                placeholder="One or two sentences for the journal index."
                className="w-full resize-y rounded-md bg-elevated px-3.5 py-2.5 text-sm leading-relaxed text-cream placeholder:text-muted outline-none focus:ring-2 focus:ring-amber/40"
              />
            </div>
          </div>
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
    </AdminShell>
  )
}
