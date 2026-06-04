import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { adminSearch, reindexAll, type SearchGroup } from '../lib/server/search'
import { EASE_OUT } from './motion-primitives'

/* ------------------------------------------------------------------ *
 * CommandPalette — the back-office ⌘K.
 *
 * Opens on ⌘K / Ctrl-K (or the header trigger). Empty query shows the
 * "go to" list (jump to any admin page); typing runs a typo-tolerant
 * Meilisearch query across orders, subscribers and journal posts
 * (server-side, admin-gated) and shows grouped, deep-linked results.
 *
 * One flat, keyboard-navigable list underneath the visual grouping:
 * ↑/↓ move, ↵ opens, esc closes. A footer "Reindex" rebuilds the
 * search indexes from Postgres if anything ever drifts.
 * ------------------------------------------------------------------ */

type NavItem = { title: string; url: string; keywords?: string }

const NAV: NavItem[] = [
  { title: 'Dashboard', url: '/admin/dashboard', keywords: 'home overview stats revenue' },
  { title: 'Orders', url: '/admin/orders', keywords: 'sales deliveries' },
  { title: 'Subscribers', url: '/admin/subscribers', keywords: 'newsletter emails list' },
  { title: 'Journal', url: '/admin/journal', keywords: 'posts blog articles' },
  { title: 'New post', url: '/admin/journal/new', keywords: 'write create article draft' },
  { title: 'Account security', url: '/admin/security', keywords: 'passkey password login' },
  { title: 'View storefront', url: '/', keywords: 'home site public landing' },
]

type FlatItem = {
  key: string
  title: string
  subtitle?: string
  url: string
  badge?: string
  groupFirst?: string // group label rendered above this item when it's the first of a group
}

const DEBOUNCE_MS = 170

export function CommandPalette() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [sel, setSel] = useState(0)
  const [reindexing, setReindexing] = useState(false)
  const [reindexNote, setReindexNote] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  // Global open/close shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Reset + focus when opened.
  useEffect(() => {
    if (open) {
      setQ('')
      setGroups([])
      setSel(0)
      setReindexNote(null)
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
  }, [open])

  // Debounced remote search.
  useEffect(() => {
    if (!open) return
    const query = q.trim()
    if (!query) {
      setGroups([])
      setLoading(false)
      return
    }
    setLoading(true)
    const id = ++reqId.current
    const t = setTimeout(async () => {
      try {
        const res = await adminSearch({ data: query })
        if (id !== reqId.current) return // a newer keystroke won
        if (!res.authed) {
          setOpen(false)
          router.navigate({ to: '/admin' } as any)
          return
        }
        setEnabled(res.enabled)
        setGroups(res.groups)
        setSel(0)
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q, open, router])

  // Filtered "go to" nav (always available; the only thing shown on empty query).
  const navMatches = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return NAV
    return NAV.filter((n) =>
      (n.title + ' ' + (n.keywords ?? '')).toLowerCase().includes(query),
    )
  }, [q])

  // One flat list for keyboard nav, carrying the group label of its first row.
  const flat = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = []
    navMatches.forEach((n, i) =>
      out.push({
        key: 'nav:' + n.url,
        title: n.title,
        subtitle: n.url,
        url: n.url,
        groupFirst: i === 0 ? 'Go to' : undefined,
      }),
    )
    for (const g of groups) {
      g.hits.forEach((h, i) =>
        out.push({
          key: g.type + ':' + h.id,
          title: h.title,
          subtitle: h.subtitle,
          url: h.url,
          badge: h.badge,
          groupFirst: i === 0 ? g.label : undefined,
        }),
      )
    }
    return out
  }, [navMatches, groups])

  const go = useCallback(
    (url: string) => {
      setOpen(false)
      router.navigate({ to: url } as any)
    },
    [router],
  )

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(flat.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[sel]
      if (item) go(item.url)
    }
  }

  // Keep the selected row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  async function doReindex() {
    setReindexing(true)
    setReindexNote(null)
    try {
      const res = await reindexAll()
      if ('counts' in res && res.counts) {
        const total = Object.values(res.counts).reduce((a, b) => a + b, 0)
        setReindexNote(`Reindexed ${total} records`)
      } else if ('enabled' in res && !res.enabled) {
        setReindexNote('Search service not configured')
      }
    } catch {
      setReindexNote('Reindex failed')
    } finally {
      setReindexing(false)
    }
  }

  return (
    <>
      {/* Header trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-muted/20 bg-elevated/60 px-3 py-1.5 font-mono text-[11px] text-taupe transition-colors hover:border-muted/40 hover:text-cream"
        aria-label="Search (Command-K)"
      >
        <SearchGlyph />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline rounded bg-espresso px-1.5 py-0.5 text-[10px] text-muted">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-espresso/75 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-xl overflow-hidden rounded-xl border border-muted/20 bg-elevated shadow-2xl"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onKeyDown={onKeyDown}
            >
              {/* Input */}
              <div className="flex items-center gap-3 border-b border-muted/15 px-4">
                <SearchGlyph />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search orders, subscribers, journal — or jump to a page…"
                  className="h-14 flex-1 bg-transparent text-[15px] text-cream placeholder:text-muted outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
                {loading && <Spinner />}
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
                {flat.length === 0 ? (
                  <p className="px-4 py-8 text-center font-mono text-[12px] text-muted">
                    {q.trim()
                      ? enabled
                        ? 'No matches.'
                        : 'Search service not configured.'
                      : 'Type to search.'}
                  </p>
                ) : (
                  flat.map((item, idx) => (
                    <div key={item.key}>
                      {item.groupFirst && (
                        <div className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                          {item.groupFirst}
                        </div>
                      )}
                      <button
                        type="button"
                        data-idx={idx}
                        onMouseMove={() => setSel(idx)}
                        onClick={() => go(item.url)}
                        className={[
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          idx === sel ? 'bg-amber/12' : 'hover:bg-surface/60',
                        ].join(' ')}
                      >
                        <span
                          aria-hidden
                          className={[
                            '-ml-4 h-8 w-0.5 shrink-0 rounded-full transition-colors',
                            idx === sel ? 'bg-amber' : 'bg-transparent',
                          ].join(' ')}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-cream">{item.title}</span>
                          {item.subtitle && (
                            <span className="block truncate font-mono text-[11px] text-muted">
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                        {item.badge && (
                          <span className="shrink-0 rounded bg-espresso px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-taupe">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 border-t border-muted/15 px-4 py-2.5">
                <div className="flex items-center gap-3 font-mono text-[10px] text-muted">
                  <Hint k="↑↓" label="navigate" />
                  <Hint k="↵" label="open" />
                  <Hint k="esc" label="close" />
                </div>
                <div className="flex items-center gap-3">
                  {reindexNote && (
                    <span className="font-mono text-[10px] text-taupe">{reindexNote}</span>
                  )}
                  <button
                    type="button"
                    onClick={doReindex}
                    disabled={reindexing}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-taupe transition-colors hover:text-amber disabled:opacity-50"
                  >
                    {reindexing ? 'Reindexing…' : '⟳ Reindex'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded bg-espresso px-1.5 py-0.5 text-taupe">{k}</kbd>
      {label}
    </span>
  )
}

function SearchGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0 text-muted"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-muted/30 border-t-amber"
    />
  )
}
