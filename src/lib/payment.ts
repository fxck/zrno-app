// Payment abstraction. Currently a SIMULATED gateway (no real charge, no keys)
// so the order flow works end-to-end. Swap `processPayment` for a real Stripe
// Checkout session later without touching the order route or UI.
export type PaymentInput = {
  amount: number // Kč
  currency: string
  orderId: string
  email: string
}

export type PaymentResult = {
  status: 'paid' | 'failed'
  provider: string
  reference: string
}

export async function processPayment(input: PaymentInput): Promise<PaymentResult> {
  const provider = process.env.PAYMENT_PROVIDER || 'simulated'

  // --- Real Stripe would go here ---
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  // const session = await stripe.checkout.sessions.create({ ... })
  // return { status: 'pending', provider: 'stripe', reference: session.id }

  // Simulated: instant success.
  return {
    status: 'paid',
    provider,
    reference: `sim_${input.orderId.slice(0, 8)}`,
  }
}
