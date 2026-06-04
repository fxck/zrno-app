import { useState, type ReactNode } from 'react'
import { TH } from './ui/table'
import { Select } from './ui/select'

/* ------------------------------------------------------------------ *
 * Table controls — instant, client-side search / filter / sort.
 *
 * The admin loaders already ship the full (modest) row set, so these
 * operate in-memory: zero round-trips, results update as you type. The
 * cross-entity, typo-tolerant search lives in the ⌘K palette
 * (Meilisearch); this is the per-table workbench.
 * ------------------------------------------------------------------ */

export type SortDir = 'asc' | 'desc'

export type SortCol<T> = {
  key: string
  get: (row: T) => string | number | null | undefined
}

export type FilterDef<T> = {
  key: string
  label: string
  options: { value: string; label: string }[]
  test: (row: T, value: string) => boolean
}

type Opts<T> = {
  searchText: (row: T) => string
  sorts: SortCol<T>[]
  filters?: FilterDef<T>[]
  initialSort?: { key: string; dir: SortDir }
}

export type TableControls<T> = {
  rows: T[]
  q: string
  setQ: (v: string) => void
  sortKey: string
  sortDir: SortDir
  toggleSort: (key: string) => void
  filters: FilterDef<T>[]
  filterValues: Record<string, string>
  setFilter: (key: string, value: string) => void
  total: number
  shown: number
}

function cmp(a: unknown, b: unknown): number {
  const an = a === null || a === undefined || a === ''
  const bn = b === null || b === undefined || b === ''
  if (an && bn) return 0
  if (an) return 1 // nulls always sort last regardless of direction flip below
  if (bn) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

export function useTableControls<T>(rows: T[], opts: Opts<T>): TableControls<T> {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState(opts.initialSort?.key ?? opts.sorts[0]?.key ?? '')
  const [sortDir, setSortDir] = useState<SortDir>(opts.initialSort?.dir ?? 'desc')
  const filters = opts.filters ?? []
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((f) => [f.key, 'all'])),
  )

  let out = rows
  const query = q.trim().toLowerCase()
  if (query) out = out.filter((r) => opts.searchText(r).toLowerCase().includes(query))
  for (const f of filters) {
    const v = filterValues[f.key]
    if (v && v !== 'all') out = out.filter((r) => f.test(r, v))
  }
  const col = opts.sorts.find((s) => s.key === sortKey)
  if (col) {
    const dir = sortDir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      const r = cmp(col.get(a), col.get(b))
      // keep nulls last in both directions: cmp already pins them, only flip real comparisons
      return r === 0 ? 0 : r * dir
    })
  }

  function toggleSort(key: string) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }
  function setFilter(key: string, value: string) {
    setFilterValues((v) => ({ ...v, [key]: value }))
  }

  return {
    rows: out,
    q,
    setQ,
    sortKey,
    sortDir,
    toggleSort,
    filters,
    filterValues,
    setFilter,
    total: rows.length,
    shown: out.length,
  }
}

// --- UI ---------------------------------------------------------------------

export function TableToolbar<T>({
  controls,
  placeholder = 'Filter…',
  children,
}: {
  controls: TableControls<T>
  placeholder?: string
  /** extra right-aligned controls (e.g. page actions) */
  children?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={controls.q}
          onChange={(e) => controls.setQ(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="h-9 w-full rounded-md border border-muted/20 bg-elevated pl-9 pr-3 text-sm text-cream placeholder:text-muted outline-none transition-colors focus:border-amber/50"
        />
      </div>

      {controls.filters.map((f) => (
        <Select
          key={f.key}
          ariaLabel={f.label}
          prefix={f.label}
          value={controls.filterValues[f.key]}
          onChange={(v) => controls.setFilter(f.key, v)}
          options={[{ value: 'all', label: 'All' }, ...f.options]}
        />
      ))}

      <span className="ml-auto font-mono text-[11px] text-muted">
        {controls.shown === controls.total
          ? `${controls.total} total`
          : `${controls.shown} of ${controls.total}`}
      </span>
      {children}
    </div>
  )
}

// Sortable header cell — click to sort, arrow shows the active column/direction.
export function SortTH<T>({
  controls,
  sortKey,
  children,
  className,
}: {
  controls: TableControls<T>
  sortKey: string
  children: ReactNode
  className?: string
}) {
  const active = controls.sortKey === sortKey
  return (
    <TH className={className}>
      <button
        type="button"
        onClick={() => controls.toggleSort(sortKey)}
        className={[
          'inline-flex items-center gap-1 transition-colors',
          active ? 'text-cream' : 'hover:text-taupe',
        ].join(' ')}
      >
        {children}
        <span aria-hidden className={active ? 'text-amber' : 'text-muted/40'}>
          {active ? (controls.sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </TH>
  )
}
