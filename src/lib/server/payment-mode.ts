import { createServerFn } from '@tanstack/react-start'
import { stripeEnabled } from '../payment'

// Tells the client whether real Stripe Checkout is configured, so the order
// page can phrase the checkout step honestly. Runs server-side only — the
// client never sees STRIPE_SECRET_KEY, just the boolean.
export const getPaymentMode = createServerFn({ method: 'GET' }).handler(() => {
  return { stripe: stripeEnabled() }
})
