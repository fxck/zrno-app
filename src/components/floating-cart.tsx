import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCart, cartSummary } from '../lib/cart'
import { EASE_OUT } from './motion-primitives'

/* ------------------------------------------------------------------ *
 * FloatingCart — a quiet pill that slides up once the cart has items.
 *
 * It's the visible thread between "I added a coffee on the landing page"
 * and "now I'll check out". Reads the shared cart store directly, so it
 * reflects adds from anywhere. Smooth, never bouncy.
 * ------------------------------------------------------------------ */
export function FloatingCart() {
  const reduce = useReducedMotion()
  const cart = useCart()
  const { count, total } = cartSummary(cart)
  const open = count > 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-x-4 bottom-5 z-50 flex justify-center md:inset-x-auto md:right-7 md:bottom-7 md:justify-end"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
        >
          <Link
            to="/order"
            aria-label={`View your order — ${count} ${count === 1 ? 'item' : 'items'}, ${total} Kč`}
            className="zrno-cart-pill group flex items-center gap-4 rounded-full border border-amber/30 bg-elevated/95 py-2.5 pl-3 pr-5 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md"
          >
            {/* count badge — gently re-pulses each time it changes */}
            <span className="relative inline-flex h-9 min-w-9 items-center justify-center overflow-hidden rounded-full bg-amber px-2 font-mono text-sm font-medium text-espresso">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={count}
                  initial={reduce ? false : { y: '110%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: '-110%', opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </span>

            <span className="flex flex-col leading-tight">
              <span className="font-mono text-[10px] tracking-[0.22em] text-taupe">
                YOUR ORDER
              </span>
              <span className="font-display text-lg leading-none text-cream">
                {total} Kč
              </span>
            </span>

            <span className="flex items-center gap-1.5 border-l border-muted/25 pl-4 font-mono text-[11px] tracking-[0.18em] text-amber">
              VIEW
              <span className="inline-block transition-transform duration-300 ease-out group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
