import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { addItem, setQty } from '../lib/cart'
import { EASE_OUT } from './motion-primitives'

/* ------------------------------------------------------------------ *
 * MenuAddControl — the menu's tie to the cart.
 *
 * qty 0 → a single ADD pill. The moment you add, it morphs into a compact
 * − n + stepper (qty lives in the shared cart), so you can build the whole
 * order from the menu itself. Stepping back to 0 morphs it back to ADD.
 * The morph is a soft crossfade — the microinteraction, no bounce.
 *
 * Fixed footprint + right-aligned so the morph never nudges the price.
 * ------------------------------------------------------------------ */
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
    <div className="flex min-w-[116px] justify-end md:min-w-[128px]">
      <AnimatePresence mode="wait" initial={false}>
        {inCart ? (
          <motion.div
            key="stepper"
            {...swap}
            className="flex items-center gap-1 rounded-full border border-amber/30 bg-elevated/70 p-1"
          >
            <StepButton
              label={`Remove one ${name}`}
              onClick={() => setQty(id, qty - 1)}
            >
              −
            </StepButton>
            <span className="w-7 text-center font-mono text-sm tabular-nums text-cream">
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
            className="zrno-add-btn group inline-flex items-center gap-2 rounded-full border border-amber/40 px-4 py-2 font-mono text-[11px] tracking-[0.2em] text-amber transition-colors duration-300 hover:bg-amber hover:text-espresso"
          >
            ADD
            <span className="inline-block transition-transform duration-300 ease-out group-hover:translate-x-0.5">
              +
            </span>
          </motion.button>
        )}
      </AnimatePresence>
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
