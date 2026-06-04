import { createFileRoute } from '@tanstack/react-router'
import { ensureDb } from '../../../lib/migrate'
import { getPool } from '../../../lib/db'
import { stripeEnabled, constructWebhookEvent } from '../../../lib/payment'
import { sendOrderConfirmation } from '../../../lib/email'
import { indexOrder } from '../../../lib/server/search'

// Stripe webhook — production-grade fulfillment, resilient to the customer
// closing the tab before the success redirect. Requires STRIPE_WEBHOOK_SECRET
// (set it from the signing secret of the dashboard webhook endpoint). Without
// it, the success-return /api/checkout/confirm still fulfills the happy path.
export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!stripeEnabled()) {
          return new Response('stripe disabled', { status: 503 })
        }
        const secret = process.env.STRIPE_WEBHOOK_SECRET
        const sig = request.headers.get('stripe-signature')
        const payload = await request.text() // RAW body, required for signature

        if (!secret || !sig) {
          // Can't verify authenticity — don't act on it.
          return new Response('webhook secret not configured', { status: 202 })
        }

        let event: any
        try {
          event = constructWebhookEvent(payload, sig, secret)
        } catch {
          return new Response('invalid signature', { status: 400 })
        }

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as any
          const orderId = session?.metadata?.orderId
          if (orderId && session.payment_status === 'paid') {
            await ensureDb()
            const upd = await getPool().query(
              `UPDATE orders SET status='paid', payment_reference=$1
               WHERE id=$2 AND status <> 'paid' RETURNING email, items, total`,
              [String(session.payment_intent ?? session.id), orderId],
            )
            if (upd.rowCount) {
              const row = upd.rows[0] as { email: string; items: any; total: number }
              const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items
              void indexOrder(orderId) // reflect the paid status in search
              await sendOrderConfirmation(row.email, { orderId, total: row.total, items })
            }
          }
        }

        return new Response('ok', { status: 200 })
      },
    },
  },
})
