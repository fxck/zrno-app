import { createFileRoute } from '@tanstack/react-router'
import { ensureDb } from '../../lib/migrate'
import { getPool } from '../../lib/db'
import { MENU_BY_ID } from '../../lib/menu'
import { processPayment, stripeEnabled, createCheckoutSession } from '../../lib/payment'
import { sendOrderConfirmation } from '../../lib/email'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const Route = createFileRoute('/api/orders')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        await ensureDb()
        const b = await request.json().catch(() => ({}) as any)
        const name = String(b?.name ?? '').trim()
        const email = String(b?.email ?? '').trim().toLowerCase()
        const rawItems = Array.isArray(b?.items) ? b.items : []

        // Re-price from the server-side menu — never trust client prices.
        const items: { id: string; name: string; qty: number; price: number }[] = []
        let total = 0
        for (const it of rawItems) {
          const m = MENU_BY_ID[String(it?.id)]
          const qty = Math.max(1, Math.min(99, parseInt(String(it?.qty), 10) || 0))
          if (!m || !qty) continue
          items.push({ id: m.id, name: m.name, qty, price: m.price })
          total += m.price * qty
        }

        if (!name || !EMAIL_RE.test(email) || items.length === 0) {
          return Response.json(
            { ok: false, error: 'Name, a valid email and at least one item are required.' },
            { status: 400 },
          )
        }

        const ins = await getPool().query(
          `INSERT INTO orders(customer_name, email, items, total, currency, status)
           VALUES($1,$2,$3,$4,'CZK','pending') RETURNING id`,
          [name, email, JSON.stringify(items), total],
        )
        const orderId = ins.rows[0].id as string

        // Real Stripe: create a Checkout Session and hand the URL to the client
        // to redirect. Fulfillment happens on return (confirm) + webhook.
        if (stripeEnabled()) {
          const origin =
            request.headers.get('origin') || `https://${request.headers.get('host')}`
          try {
            const { url, id } = await createCheckoutSession({ orderId, items, email, origin })
            await getPool().query(
              `UPDATE orders SET payment_provider='stripe', payment_reference=$1 WHERE id=$2`,
              [id, orderId],
            )
            return Response.json({ ok: true, mode: 'stripe', checkoutUrl: url, orderId })
          } catch (err) {
            console.error('[orders] stripe session failed', err)
            return Response.json(
              { ok: false, error: 'Could not start checkout. Try again.' },
              { status: 502 },
            )
          }
        }

        // Simulated fallback (no Stripe keys configured).
        const pay = await processPayment({ amount: total, currency: 'CZK', orderId, email })
        await getPool().query(
          'UPDATE orders SET status=$1, payment_provider=$2, payment_reference=$3 WHERE id=$4',
          [pay.status, pay.provider, pay.reference, orderId],
        )
        if (pay.status === 'paid') {
          await sendOrderConfirmation(email, { orderId, total, items })
        }
        return Response.json({ ok: true, mode: 'simulated', orderId, total, status: pay.status })
      },
    },
  },
})
