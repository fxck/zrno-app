import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCart, cartSummary } from '../lib/cart'
import { Wordmark } from './bean-mark'
import {
  EASE_OUT,
  MagneticButton,
  SOFT_SPRING,
  useActiveSection,
  useScrolled,
} from './motion-primitives'

/* ------------------------------------------------------------------ *
 * SiteHeader — ONE header for the whole site.
 *
 * Identical geometry on every page (same paddings, same condense-on-
 * scroll, same right-hand CTA height) so navigating between routes
 * never makes the bar jump. On the landing page the nav lights up the
 * section you're looking at (scrollspy); on sub-pages the same links
 * jump back to those sections via cross-page anchors.
 * ------------------------------------------------------------------ */

const SECTIONS = [
  { label: 'Menu', id: 'menu' },
  { label: 'Roastery', id: 'story' },
  { label: 'Visit', id: 'visit' },
] as const

const SECTION_IDS = SECTIONS.map((s) => s.id)

export function SiteHeader({
  variant = 'page',
  /** sub-page right slot: show a "back" link instead of the order CTA */
  back = false,
  backTo = '/',
  backLabel = '← BACK',
}: {
  variant?: 'home' | 'page'
  back?: boolean
  backTo?: string
  backLabel?: string
}) {
  const reduce = useReducedMotion()
  const scrolled = useScrolled(28)
  const isHome = variant === 'home'
  // Scrollspy only runs on the landing page (the only place the sections live).
  const active = useActiveSection(isHome ? SECTION_IDS : [])
  const cart = useCart()
  const { count, total } = cartSummary(cart)

  return (
    <motion.header
      className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b hairline px-6 md:px-14"
      initial={false}
      animate={{
        paddingTop: scrolled ? 12 : 18,
        paddingBottom: scrolled ? 12 : 18,
        backgroundColor: scrolled ? 'rgba(11,9,8,0.92)' : 'rgba(11,9,8,0.80)',
      }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      style={{
        backdropFilter: scrolled ? 'blur(14px)' : 'blur(8px)',
        WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'blur(8px)',
      }}
    >
      {/* Wordmark — anchors home (on the landing page, to the very top).
          The O is the angled bean mark (shared identity). */}
      {isHome ? (
        <a href="#top" className="shrink-0">
          <Wordmark className="text-2xl text-cream" />
        </a>
      ) : (
        <Link to="/" className="shrink-0">
          <Wordmark className="text-2xl text-cream" />
        </Link>
      )}

      {/* Center nav — scrollspy active state on home, cross-page anchors elsewhere */}
      <nav className="hidden md:flex items-center gap-1 font-mono text-[11px] tracking-[0.18em]">
        {SECTIONS.map(({ label, id }) => {
          const isActive = isHome && active === id
          return (
            <a
              key={id}
              href={isHome ? `#${id}` : `/#${id}`}
              aria-current={isActive ? 'true' : undefined}
              className={[
                'relative px-3 py-1.5 transition-colors duration-300',
                isActive ? 'text-cream' : 'text-taupe hover:text-cream',
              ].join(' ')}
            >
              {label.toUpperCase()}
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-x-3 -bottom-px h-px bg-amber"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: 'spring', ...SOFT_SPRING }
                  }
                />
              )}
            </a>
          )
        })}
      </nav>

      {/* Right slot — fixed-height CTA so the bar is the same height everywhere */}
      {back ? (
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 border border-muted/30 font-mono text-[11px] tracking-[0.18em] text-taupe px-5 py-3 hover:border-muted/60 hover:text-cream transition-colors duration-300 shrink-0"
        >
          {backLabel}
        </Link>
      ) : (
        <MagneticButton strength={0.28} radius={80}>
          <Link
            to="/order"
            aria-label={count > 0 ? `Order online — ${count} in cart` : 'Order online'}
            className="zrno-cta relative inline-flex items-center gap-2 bg-amber text-espresso font-mono text-[11px] tracking-[0.18em] px-5 py-3 hover:bg-amberdeep transition-colors duration-300 shrink-0"
          >
            ORDER
            {/* When the cart has items the button becomes the cart itself —
                showing the live total — so there's one order control, not a
                header button AND a floating pill saying the same thing. */}
            {count > 0 ? (
              <span className="tabular-nums overflow-hidden">
                ·{' '}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={total}
                    initial={reduce ? false : { y: '70%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { y: '-70%', opacity: 0 }}
                    transition={{ duration: 0.32, ease: EASE_OUT }}
                    className="inline-block"
                  >
                    {total}
                  </motion.span>
                </AnimatePresence>{' '}
                Kč
              </span>
            ) : (
              <span className="hidden sm:inline">ONLINE</span>
            )}
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key="count"
                  initial={reduce ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', ...SOFT_SPRING }}
                  className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-espresso px-1.5 font-mono text-[10px] text-amber tabular-nums"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </MagneticButton>
      )}
    </motion.header>
  )
}
