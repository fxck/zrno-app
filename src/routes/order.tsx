import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MENU } from '../lib/menu'
import { useCart, cartSummary, setQty, removeItem, clearCart } from '../lib/cart'
import { Button } from '../components/ui/button'
import { Input, Label } from '../components/ui/input'
import { MenuAddControl } from '../components/menu-add-control'
import { EASE_OUT, MaskedLines } from '../components/motion-primitives'

export const Route = createFileRoute('/order')({
  validateSearch: (s: Record<string, unknown>) => ({
    success: String(s.success ?? '') === '1',
    canceled: String(s.canceled ?? '') === '1',
    session_id: typeof s.session_id === 'string' ? s.session_id : undefined,
  }),
  component: OrderPage,
})

type OrderResult = { orderId: string; total: number; status: string }

function OrderPage() {
  const reduce = useReducedMotion()
  const cart = useCart()
  const { lines, count, total } = cartSummary(cart)
  const { success, canceled, session_id } = Route.useSearch()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<OrderResult | null>(null)
  const [confirming, setConfirming] = useState(success && Boolean(session_id))

  // Returning from Stripe Checkout: confirm the session → mark paid + receipt.
  useEffect(() => {
    if (!success || !session_id || done) return
    let cancelledFx = false
    setConfirming(true)
    fetch('/api/checkout/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: session_id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelledFx) return
        if (d.ok) {
          clearCart()
          setDone({ orderId: d.orderId, total: d.total, status: d.status })
        } else {
          setError(d.error || 'We could not confirm your payment.')
        }
      })
      .catch(() => !cancelledFx && setError('We could not confirm your payment.'))
      .finally(() => !cancelledFx && setConfirming(false))
    return () => {
      cancelledFx = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success, session_id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!count) return setError('Add at least one item from the menu.')
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          items: lines.map((l) => ({ id: l.item.id, qty: l.qty })),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.')
      // Stripe → redirect to Checkout (cart is cleared on a successful return).
      if (data.mode === 'stripe' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }
      // Simulated → done immediately.
      clearCart()
      setDone({ orderId: data.orderId, total: data.total, status: data.status })
    } catch (err: any) {
      setError(err.message || 'Order failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-espresso text-cream font-body">
      <header className="flex items-center justify-between px-6 md:px-14 py-5 border-b border-muted/15">
        <Link to="/" className="font-display text-2xl tracking-wider">
          ZRNO
        </Link>
        <Link to="/" className="font-mono text-[11px] tracking-[0.18em] text-taupe hover:text-cream transition-colors">
          ← BACK TO SITE
        </Link>
      </header>

      {done ? (
        <Confirmation result={done} />
      ) : confirming ? (
        <ConfirmingView />
      ) : (
        <main className="px-6 md:px-14 py-12 md:py-16 grid lg:grid-cols-[1.4fr_1fr] gap-12 max-w-6xl">
          {canceled && (
            <div className="lg:col-span-2 -mb-4 border-l-2 border-amber bg-elevated/60 px-4 py-3 text-sm text-taupe">
              Payment canceled — your order is still here whenever you’re ready.
            </div>
          )}
          <section>
            <motion.div
              className="font-mono text-xs tracking-[0.2em] text-amber"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={reduce ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              ORDER ONLINE
            </motion.div>
            <h1 className="font-display t-lg mt-3 mb-10">
              <MaskedLines lines={['PICK YOUR CUP']} trigger="mount" delay={0.06} />
            </h1>
            <div>
              {MENU.map((m, i) => (
                <motion.div
                  key={m.id}
                  className="flex items-center justify-between gap-4 border-t border-muted/15 py-5"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={reduce ? {} : { opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    ease: EASE_OUT,
                    delay: reduce ? 0 : 0.12 + i * 0.05,
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-display text-2xl md:text-3xl leading-none">
                      {m.name.toUpperCase()}
                    </div>
                    <div className="text-sm text-taupe mt-1">{m.desc}</div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-sm text-amber w-14 text-right tabular-nums">
                      {m.price} Kč
                    </span>
                    <MenuAddControl id={m.id} name={m.name} qty={cart[m.id] || 0} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <aside className="lg:sticky lg:top-8 h-fit bg-surface border border-muted/20 p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] tracking-[0.2em] text-taupe">YOUR ORDER</div>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => clearCart()}
                  className="font-mono text-[10px] tracking-[0.15em] text-muted hover:text-taupe transition-colors"
                >
                  CLEAR
                </button>
              )}
            </div>

            <div className="mt-5 min-h-16">
              {lines.length === 0 ? (
                <p className="text-taupe text-sm leading-relaxed">
                  Your order is empty — add something from the menu and it’ll show up here.
                </p>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  {lines.map((line) => (
                    <motion.div
                      key={line.item.id}
                      layout
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.32, ease: EASE_OUT }}
                      className="flex items-center justify-between gap-3 border-b border-muted/10 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-cream truncate">{line.item.name}</div>
                        <div className="text-[11px] text-muted mt-0.5 tabular-nums">
                          {line.item.price} Kč each
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1 rounded-full border border-muted/25 p-0.5">
                          <SummaryStep
                            label={`Remove one ${line.item.name}`}
                            onClick={() => setQty(line.item.id, line.qty - 1)}
                          >
                            −
                          </SummaryStep>
                          <span className="w-5 text-center font-mono text-xs tabular-nums text-cream">
                            {line.qty}
                          </span>
                          <SummaryStep
                            label={`Add one ${line.item.name}`}
                            accent
                            onClick={() => setQty(line.item.id, line.qty + 1)}
                          >
                            +
                          </SummaryStep>
                        </div>
                        <span className="w-16 text-right font-mono text-sm text-taupe tabular-nums">
                          {line.lineTotal} Kč
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(line.item.id)}
                          aria-label={`Remove ${line.item.name} from your order`}
                          className="text-muted hover:text-cream transition-colors text-sm leading-none"
                        >
                          ✕
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="flex justify-between items-end border-t border-muted/20 mt-5 pt-5">
              <span className="font-mono text-[11px] tracking-[0.2em] text-taupe">TOTAL</span>
              <span className="font-display text-3xl text-amber tabular-nums overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={total}
                    initial={reduce ? false : { y: '60%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { y: '-60%', opacity: 0 }}
                    transition={{ duration: 0.32, ease: EASE_OUT }}
                    className="inline-block"
                  >
                    {total}
                  </motion.span>
                </AnimatePresence>{' '}
                Kč
              </span>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jan Novák" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.cz" required />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={busy || !count}>
                {busy ? 'Redirecting to checkout…' : count ? `Pay ${total} Kč` : 'Add an item to continue'}
              </Button>
              <p className="text-muted text-[11px] leading-relaxed">
                You’ll complete payment securely on Stripe. Test mode — use card{' '}
                <span className="text-taupe">4242 4242 4242 4242</span>, any future date &amp; CVC.
                A confirmation email follows.
              </p>
            </form>
          </aside>
        </main>
      )}
    </div>
  )
}

function ConfirmingView() {
  return (
    <main className="px-6 md:px-14 py-24 max-w-2xl">
      <div className="font-mono text-xs tracking-[0.2em] text-amber">CONFIRMING PAYMENT</div>
      <h1 className="font-display t-lg mt-3">
        <MaskedLines lines={['ONE MOMENT…']} trigger="mount" />
      </h1>
      <p className="text-taupe mt-6 leading-relaxed max-w-md">
        We’re confirming your payment with Stripe — this only takes a second.
      </p>
    </main>
  )
}

function SummaryStep({
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
        'flex h-6 w-6 items-center justify-center rounded-full text-sm leading-none transition-colors duration-200',
        accent
          ? 'bg-amber text-espresso hover:bg-amberdeep'
          : 'text-taupe hover:bg-elevated hover:text-cream',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Confirmation({ result }: { result: OrderResult }) {
  return (
    <main className="px-6 md:px-14 py-24 max-w-2xl">
      <div className="font-mono text-xs tracking-[0.2em] text-amber">ORDER {result.status.toUpperCase()}</div>
      <h1 className="font-display t-lg mt-3">
        <MaskedLines lines={['THANK YOU.']} trigger="mount" />
      </h1>
      <p className="text-taupe mt-6 leading-relaxed max-w-md">
        Order <span className="text-cream">#{result.orderId.slice(0, 8)}</span> is paid. We’ve sent a
        confirmation email. Total charged:{' '}
        <span className="text-amber">{result.total} Kč</span>.
      </p>
      <div className="flex gap-4 mt-10">
        <Link to="/">
          <Button variant="outline">Back to site</Button>
        </Link>
        <Button onClick={() => window.location.reload()}>Place another order</Button>
      </div>
    </main>
  )
}
