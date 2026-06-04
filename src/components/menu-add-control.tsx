import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { addItem, setQty } from '../lib/cart'
import { BeanMark } from './bean-mark'
import { EASE_OUT } from './motion-primitives'

/* ------------------------------------------------------------------ *
 * MenuAddControl — the menu's tie to the cart.
 *
 * The control is taken OUT OF FLOW: the wrapper is a fixed-size slot and
 * the pill/stepper are absolutely right-anchored inside it, so morphing
 * ADD ⇄ stepper (different widths) never reflows the row — the menu
 * item's name/description never shift.
 *
 * The "pour": an amber flood rises from the bottom of the pill — slow and
 * béchamel-smooth (long EASE_SOFT) — and it's driven by hovering the WHOLE
 * row (group/row) as well as the pill itself (group/add). The bean (the
 * ZRNO "O") tips, and the label inverts to espresso, in the same easing.
 *
 * qty 0 → ADD pill. Adding morphs it to a compact − n + stepper (qty lives
 * in the shared cart). Stepping back to 0 morphs it back.
 * ------------------------------------------------------------------ */

// One long, calm "mixing béchamel" curve for every hover transition.
const BECHAMEL = 'duration-[600ms] ease-[cubic-bezier(0.33,0,0.2,1)]'

export function MenuAddControl({
  id,
  name,
  qty,
}: {
  id: string
  name: string
  qty: number
}) {
  const reduce = useReducedMotion()
  const inCart = qty > 0

  const swap = {
    initial: reduce ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: { duration: 0.32, ease: EASE_OUT },
  }

  return (
    <div className="relative h-10 w-[116px] md:w-[128px]">
      {/* Right-anchored, vertically centred, out of flow. */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <AnimatePresence mode="wait" initial={false}>
          {inCart ? (
            <motion.div
              key="stepper"
              {...swap}
              className="flex items-center gap-1 rounded-full border border-amber/30 bg-elevated/80 p-1 backdrop-blur-sm"
            >
              <StepButton
                label={`Remove one ${name}`}
                onClick={() => setQty(id, qty - 1)}
              >
                −
              </StepButton>
              <span className="w-7 overflow-hidden text-center font-mono text-sm tabular-nums text-cream">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={qty}
                    initial={reduce ? false : { y: '90%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { y: '-90%', opacity: 0 }}
                    transition={{ duration: 0.28, ease: EASE_OUT }}
                    className="inline-block"
                  >
                    {qty}
                  </motion.span>
                </AnimatePresence>
              </span>
              <StepButton
                label={`Add one ${name}`}
                accent
                onClick={() => addItem(id, 1)}
              >
                +
              </StepButton>
            </motion.div>
          ) : (
            <motion.button
              key="add"
              type="button"
              {...swap}
              onClick={() => addItem(id, 1)}
              aria-label={`Add ${name} to your order`}
              whileTap={reduce ? undefined : { scale: 0.94 }}
              className="zrno-add group/add relative isolate inline-flex items-center gap-2 overflow-hidden rounded-full border border-amber/50 px-4 py-2 font-mono text-[11px] tracking-[0.2em] text-amber"
            >
              {/* The pour — rises on row-hover OR pill-hover, béchamel-slow. */}
              <span
                aria-hidden
                className={`absolute inset-0 -z-10 origin-bottom scale-y-0 rounded-full bg-amber transition-transform ${BECHAMEL} group-hover/add:scale-y-100 group-hover/row:scale-y-100`}
              />
              <BeanMark
                className={`h-[1.05em] w-[0.8em] transition-[transform,color] ${BECHAMEL} group-hover/add:rotate-[26deg] group-hover/add:text-espresso group-hover/row:rotate-[26deg] group-hover/row:text-espresso`}
              />
              <span
                className={`transition-colors ${BECHAMEL} group-hover/add:text-espresso group-hover/row:text-espresso`}
              >
                ADD
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StepButton({
  children,
  onClick,
  label,
  accent = false,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-full text-base leading-none transition-colors duration-200',
        accent
          ? 'bg-amber text-espresso hover:bg-amberdeep'
          : 'text-taupe hover:bg-surface hover:text-cream',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
