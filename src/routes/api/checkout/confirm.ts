import { createFileRoute } from '@tanstack/react-router'
import { ensureDb } from '../../../lib/migrate'
import { getPool } from '../../../lib/db'
import { stripeEnabled, retrieveCheckoutSession } from '../../../lib/payment'
import { sendOrderConfirmation } from '../../../lib/email'

// Called by the order page when the customer returns from Stripe Checkout.
// Retrieves the session, and if it's paid, marks the order paid + sends the
// confirmation email (idempotent). This makes Checkout work end-to-end with
// only STRIPE_SECRET_KEY — no webhook required for the happy path.
export const Route = createFileRoute('/api/checkout/confirm')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!stripeEnabled()) {
          return Response.json({ ok: false, error: 'Stripe is not configured.' }, { status: 503 })
        }
        await ensureDb()
        const body = await request.json().catch(() => ({}) as any)
        const sessionId = String(body?.sessionId ?? '')
        if (!sessionId) {
          return Response.json({ ok: false, error: 'Missing session id.' }, { status: 400 })
        }

        let session: any
        try {
          session = await retrieveCheckoutSession(sessionId)
        } catch {
          return Response.json({ ok: false, error: 'Unknown checkout session.' }, { status: 400 })
        }

        const orderId = session?.metadata?.orderId
        if (!orderId) {
          return Response.json({ ok: false, error: 'Session has no order.' }, { status: 400 })
        }

        const ord = await getPool().query(
          'SELECT id, email, items, total, status FROM orders WHERE id = $1 LIMIT 1',
          [orderId],
        )
        if (!ord.rowCount) {
          return Response.json({ ok: false, error: 'Order not found.' }, { status: 404 })
        }
        const row = ord.rows[0] as {
          email: string
          items: any
          total: number
          status: string
        }

        const paid = session.payment_status === 'paid'
        if (paid) {
          // Mark paid only once → send the email only once.
          const upd = await getPool().query(
            `UPDATE orders SET status='paid', payment_reference=$1
             WHERE id=$2 AND status <> 'paid' RETURNING id`,
            [String(session.payment_intent ?? session.id), orderId],
          )
          if (upd.rowCount) {
            const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items
            await sendOrderConfirmation(row.email, { orderId, total: row.total, items })
          }
          return Response.json({ ok: true, orderId, total: row.total, status: 'paid' })
        }

        return Response.json({ ok: true, orderId, total: row.total, status: row.status })
      },
    },
  },
})
