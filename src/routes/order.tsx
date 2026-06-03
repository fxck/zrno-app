import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { MENU } from '../lib/menu'
import { Button } from '../components/ui/button'
import { Input, Label } from '../components/ui/input'

export const Route = createFileRoute('/order')({ component: OrderPage })

type OrderResult = { orderId: string; total: number; status: string }

function OrderPage() {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<OrderResult | null>(null)

  const items = MENU.map((m) => ({ ...m, qty: qty[m.id] || 0 })).filter((i) => i.qty > 0)
  const total = items.reduce((s, i) => s + i.price * i.qty, 0)
  const bump = (id: string, d: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(99, (q[id] || 0) + d)) }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!items.length) return setError('Add at least one item.')
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, items: items.map((i) => ({ id: i.id, qty: i.qty })) }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.')
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
        <Link to="/" className="font-mono text-[11px] tracking-[0.18em] text-taupe hover:text-cream">
          ← BACK TO SITE
        </Link>
      </header>

      {done ? (
        <Confirmation result={done} />
      ) : (
        <main className="px-6 md:px-14 py-12 md:py-16 grid lg:grid-cols-[1.4fr_1fr] gap-12 max-w-6xl">
          <section>
            <div className="font-mono text-xs tracking-[0.2em] text-amber">ORDER ONLINE</div>
            <h1 className="font-display t-lg mt-3 mb-10">PICK YOUR CUP</h1>
            <div>
              {MENU.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-4 border-t border-muted/15 py-5"
                >
                  <div>
                    <div className="font-display text-2xl md:text-3xl leading-none">
                      {m.name.toUpperCase()}
                    </div>
                    <div className="text-sm text-taupe mt-1">{m.desc}</div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-sm text-amber w-16 text-right">{m.price} Kč</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => bump(m.id, -1)}
                        className="h-8 w-8 border border-muted/40 text-cream hover:bg-elevated text-lg leading-none"
                        aria-label={`Remove one ${m.name}`}
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-mono">{qty[m.id] || 0}</span>
                      <button
                        type="button"
                        onClick={() => bump(m.id, 1)}
                        className="h-8 w-8 bg-amber text-espresso hover:bg-amberdeep text-lg leading-none"
                        aria-label={`Add one ${m.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="lg:sticky lg:top-8 h-fit bg-surface border border-muted/20 p-6 md:p-8">
            <div className="font-mono text-[11px] tracking-[0.2em] text-taupe">YOUR ORDER</div>
            <div className="mt-5 space-y-2 min-h-16">
              {items.length === 0 ? (
                <p className="text-taupe text-sm">No items yet — add something from the menu.</p>
              ) : (
                items.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-cream">
                      {i.qty}× {i.name}
                    </span>
                    <span className="text-taupe">{i.price * i.qty} Kč</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-between items-end border-t border-muted/20 mt-5 pt-5">
              <span className="font-mono text-[11px] tracking-[0.2em] text-taupe">TOTAL</span>
              <span className="font-display text-3xl text-amber">{total} Kč</span>
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
              <Button type="submit" size="lg" className="w-full" disabled={busy || !items.length}>
                {busy ? 'Placing order…' : `Pay ${total} Kč`}
              </Button>
              <p className="text-muted text-[11px] leading-relaxed">
                Payment is simulated for this demo — no card is charged. A confirmation email is sent
                to Mailpit.
              </p>
            </form>
          </aside>
        </main>
      )}
    </div>
  )
}

function Confirmation({ result }: { result: OrderResult }) {
  return (
    <main className="px-6 md:px-14 py-24 max-w-2xl">
      <div className="font-mono text-xs tracking-[0.2em] text-amber">ORDER {result.status.toUpperCase()}</div>
      <h1 className="font-display t-lg mt-3">THANK YOU.</h1>
      <p className="text-taupe mt-6 leading-relaxed max-w-md">
        Order <span className="text-cream">#{result.orderId.slice(0, 8)}</span> is in. We’ve sent a
        confirmation email — open the Mailpit inbox to see it. Total charged:{' '}
        <span className="text-amber">{result.total} Kč</span> (simulated).
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
