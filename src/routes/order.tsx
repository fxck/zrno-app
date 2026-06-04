import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MENU } from '../lib/menu'
import { useCart, cartSummary, setQty, removeItem, clearCart } from '../lib/cart'
import { Button } from '../components/ui/button'
import { Input, Label } from '../components/ui/input'
import { MenuAddControl } from '../components/menu-add-control'
import { getPaymentMode } from '../lib/server/payment-mode'
import { EASE_OUT, MaskedLines } from '../components/motion-primitives'
import { BeanRain } from '../components/bean-rain'
import { Wordmark } from '../components/bean-mark'

export const Route = createFileRoute('/order')({
  validateSearch: (s: Record<string, unknown>) => ({
    // Accept '1', 'true', and boolean true so the flag survives TanStack
    // Router's canonical re-serialization (1 → true → 'true' → …).
    success: s.success === '1' || s.success === 'true' || s.success === true,
    canceled: s.canceled === '1' || s.canceled === 'true' || s.canceled === true,
    session_id: typeof s.session_id === 'string' ? s.session_id : undefined,
  }),
  loader: async () => getPaymentMode(),
  component: OrderPage,
})

type OrderResult = { orderId: string; total: number; status: string }

function OrderPage() {
  const reduce = useReducedMotion()
  const cart = useCart()
  const { lines, count, total } = cartSummary(cart)
  const { canceled, session_id } = Route.useSearch()
  const { stripe: stripeOn } = Route.useLoaderData()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<OrderResult | null>(null)
  const [confirmFailed, setConfirmFailed] = useState(false)

  // Returning from Stripe Checkout: a session_id (and not canceled) → confirm
  // it with the server, which marks the order paid + shows the receipt. Keyed
  // off session_id rather than the success flag so a flaky flag can't skip it.
  useEffect(() => {
    if (!session_id || canceled || done) return
    let cancelledFx = false
    // Confirm is usually instant — without a floor the ConfirmingView would
    // blink past before its mount animation can play. Hold it for a minimum
    // beat so the "ONE MOMENT…" reveal reads as a deliberate step, not a flash.
    const start = Date.now()
    const MIN_CONFIRM_MS = 1300
    const settle = (fn: () => void) => {
      if (cancelledFx) return
      const wait = Math.max(0, MIN_CONFIRM_MS - (Date.now() - start))
      setTimeout(() => {
        if (!cancelledFx) fn()
      }, wait)
    }
    fetch('/api/checkout/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: session_id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          settle(() => {
            clearCart()
            setDone({ orderId: d.orderId, total: d.total, status: d.status })
          })
        } else {
          settle(() => {
            setError(d.error || 'We could not confirm your payment.')
            setConfirmFailed(true)
          })
        }
      })
      .catch(() => {
        settle(() => {
          setError('We could not confirm your payment.')
          setConfirmFailed(true)
        })
      })
    return () => {
      cancelledFx = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, canceled])

  // Returning from Checkout → never flash the order form. Derived from
  // session_id each render (not one-time state) so a late-resolving search
  // param can't let the form paint for a frame first.
  const showConfirming = Boolean(session_id) && !canceled && !done && !confirmFailed

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

      {done ? (
        <Confirmation result={done} stripeOn={stripeOn} />
      ) : showConfirming ? (
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
                  className="group/row flex items-center justify-between gap-4 border-t border-muted/15 py-5"
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
                {busy
                  ? stripeOn
                    ? 'Redirecting to checkout…'
                    : 'Placing order…'
                  : count
                    ? `Pay ${total} Kč`
                    : 'Add an item to continue'}
              </Button>
              {stripeOn ? (
                <p className="text-muted text-[11px] leading-relaxed">
                  You’ll complete payment securely on Stripe. Test mode — use card{' '}
                  <span className="text-taupe">4242 4242 4242 4242</span>, any future date &amp; CVC.
                  A confirmation email follows.
                </p>
              ) : (
                <p className="text-muted text-[11px] leading-relaxed">
                  Demo checkout — no card details and no real payment. Your order is
                  recorded and a confirmation email follows. Add a Stripe key to take
                  real payments.
                </p>
              )}
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

function Confirmation({ result, stripeOn }: { result: OrderResult; stripeOn: boolean }) {
  const reduce = useReducedMotion()
  // Permanent, link-by-id order page. Encoded into a QR so the customer can
  // pull up their receipt anytime — and so staff can scan it to mark the
  // order delivered (the /o/$id page shows a "mark delivered" control to a
  // logged-in admin). Built on the client so we have window.location.origin.
  const [orderUrl, setOrderUrl] = useState('')
  const [qr, setQr] = useState('')

  useEffect(() => {
    const url = `${window.location.origin}/o/${result.orderId}`
    setOrderUrl(url)
    let alive = true
    // Lazy-load qrcode so it never weighs on the rest of the app's bundle.
    // qrcode is CommonJS — grab the default export under ESM interop.
    import('qrcode')
      .then((mod) => {
        const QR = (mod as any).default ?? mod
        return QR.toDataURL(url, {
          margin: 1,
          width: 240,
          color: { dark: '#0b0908', light: '#f4ece0' },
        }) as Promise<string>
      })
      .then((dataUrl) => {
        if (alive) setQr(dataUrl)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [result.orderId])

  return (
    <main className="px-6 md:px-14 py-20 md:py-28 max-w-3xl mx-auto">
      <div className="text-center font-mono text-xs tracking-[0.3em] text-amber">
        ORDER {stripeOn ? result.status.toUpperCase() : 'CONFIRMED'}
      </div>
      <h1 className="font-display t-lg mt-4 text-center">
        <BeanRain lines={['THANK YOU.']} />
      </h1>
      <p className="text-taupe mt-6 leading-relaxed text-center max-w-md mx-auto">
        Order <span className="text-cream">#{result.orderId.slice(0, 8)}</span>{' '}
        {stripeOn ? 'is paid' : 'is confirmed'}. We’ve sent a confirmation email.
      </p>

      {/* The order pass — a ticket. QR up top on a cream tile, a perforated
          tear line, then the stub with order + total. Show it at the bar. */}
      <motion.div
        className="mt-12 mx-auto max-w-sm"
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
      >
        <div className="relative overflow-hidden rounded-2xl border border-amber/25 bg-surface shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between px-6 pt-6">
            <Wordmark className="text-lg text-cream" />
            <span className="font-mono text-[10px] tracking-[0.28em] text-amber">
              ORDER PASS
            </span>
          </div>

          <div className="flex justify-center px-6 py-8">
            <div className="rounded-xl bg-cream p-4 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)]">
              {qr ? (
                <img
                  src={qr}
                  alt="QR code linking to your order"
                  width={168}
                  height={168}
                  className="h-[168px] w-[168px]"
                />
              ) : (
                <div className="h-[168px] w-[168px] animate-pulse rounded bg-muted/30" />
              )}
            </div>
          </div>

          {/* Perforated tear line with punched notches on each edge. */}
          <div className="relative">
            <div className="mx-6 border-t border-dashed border-muted/40" />
            <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-espresso" />
            <span className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-espresso" />
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 py-6 font-mono">
            <div>
              <div className="text-[10px] tracking-[0.2em] text-muted">ORDER</div>
              <div className="mt-1 text-sm text-cream">
                #{result.orderId.slice(0, 8)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-[0.2em] text-muted">TOTAL</div>
              <div className="mt-1 text-sm text-amber tabular-nums">
                {result.total} Kč
              </div>
            </div>
            {orderUrl && (
              <a
                href={orderUrl}
                className="col-span-2 mt-1 break-all text-[11px] leading-relaxed text-taupe hover:text-cream transition-colors"
              >
                {orderUrl.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Scan to pull up your order · show it at the bar to collect.
        </p>
      </motion.div>

      <div className="flex gap-4 mt-12 justify-center">
        <Link to="/">
          <Button variant="outline">Back to site</Button>
        </Link>
        <Button onClick={() => window.location.reload()}>Place another order</Button>
      </div>
    </main>
  )
}
