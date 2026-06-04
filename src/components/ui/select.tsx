import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '../../lib/utils'

/* ------------------------------------------------------------------ *
 * Select — a small dark-themed dropdown to replace the native <select>
 * (whose OS-painted list clashes with the black UI). Trigger shows
 * "Prefix: Value"; the menu animates in, supports click-outside / Esc /
 * ↑↓ / ↵, and marks the active option with an amber check.
 * ------------------------------------------------------------------ */

export type SelectOption = { value: string; label: string }

export function Select({
  value,
  onChange,
  options,
  prefix,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** small leading label, e.g. "Status" → renders "Status: All" */
  prefix?: string
  ariaLabel?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, options, value])

  function choose(v: string) {
    onChange(v)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((a) => Math.min(options.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open) choose(options[active].value)
      else setOpen(true)
    }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-9 items-center gap-2 rounded-md border bg-elevated px-3 font-mono text-[11px] uppercase tracking-[0.1em] outline-none transition-colors',
          open
            ? 'border-amber/60 text-cream'
            : 'border-muted/20 text-taupe hover:border-muted/40 hover:text-cream',
        )}
      >
        <span className="whitespace-nowrap">
          {prefix && <span className="text-muted">{prefix}: </span>}
          {current?.label}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 z-50 mt-1.5 min-w-full overflow-hidden rounded-lg border border-muted/20 bg-elevated py-1 shadow-2xl"
          >
            {options.map((o, i) => {
              const selected = o.value === value
              return (
                <li key={o.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => choose(o.value)}
                    onMouseMove={() => setActive(i)}
                    className={cn(
                      'flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.1em] transition-colors',
                      i === active ? 'bg-surface/70' : '',
                      selected ? 'text-amber' : 'text-taupe',
                    )}
                  >
                    <span aria-hidden className="w-3 shrink-0 text-amber">
                      {selected ? '✓' : ''}
                    </span>
                    {o.label}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
