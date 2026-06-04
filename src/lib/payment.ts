import Stripe from 'stripe'

// Payment layer. Uses real Stripe Checkout when STRIPE_SECRET_KEY is set;
// falls back to a simulated instant-success gateway otherwise (so the order
// flow still works locally / without keys).

export type CartLineItem = {
  id: string
  name: string
  qty: number
  price: number // Kč
}

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
  return _stripe
}

// CZK is a 2-decimal currency for Stripe → amounts are in haléř (×100).
function toMinorUnit(czk: number): number {
  return Math.round(czk * 100)
}

export async function createCheckoutSession(opts: {
  orderId: string
  items: CartLineItem[]
  email: string
  origin: string
}): Promise<{ url: string; id: string }> {
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email || undefined,
    line_items: opts.items.map((it) => ({
      quantity: it.qty,
      price_data: {
        currency: 'czk',
        unit_amount: toMinorUnit(it.price),
        product_data: { name: it.name },
      },
    })),
    success_url: `${opts.origin}/order?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/order?canceled=1`,
    metadata: { orderId: opts.orderId },
    payment_intent_data: { metadata: { orderId: opts.orderId } },
  })
  return { url: session.url || '', id: session.id }
}

export async function retrieveCheckoutSession(sessionId: string) {
  return getStripe().checkout.sessions.retrieve(sessionId)
}

export function constructWebhookEvent(payload: string, signature: string, secret: string) {
  return getStripe().webhooks.constructEvent(payload, signature, secret)
}

// --- Simulated fallback (no Stripe keys) -----------------------------------
export type PaymentInput = { amount: number; currency: string; orderId: string; email: string }
export type PaymentResult = { status: 'paid' | 'failed'; provider: string; reference: string }

export async function processPayment(input: PaymentInput): Promise<PaymentResult> {
  return {
    status: 'paid',
    provider: 'simulated',
    reference: `sim_${input.orderId.slice(0, 8)}`,
  }
}
