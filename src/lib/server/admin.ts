import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth'
import { getPool } from '../db'
import { ensureDb } from '../migrate'

export type Order = {
  id: string
  customer_name: string
  email: string
  items: { id: string; name: string; qty: number; price: number }[]
  total: number
  currency: string
  status: string
  created_at: string
}
export type Subscriber = { id: string; email: string; created_at: string }

// Session-gated dashboard payload. Runs server-side only; reads the
// better-auth session cookie off the incoming request.
export const getDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  await ensureDb()
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return { authed: false as const }
  }

  const orders = (
    await getPool().query(
      `SELECT id, customer_name, email, items, total, currency, status, created_at
       FROM orders ORDER BY created_at DESC LIMIT 100`,
    )
  ).rows as Order[]
  const subscribers = (
    await getPool().query(
      `SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC LIMIT 200`,
    )
  ).rows as Subscriber[]

  const revenue = orders
    .filter((o) => o.status === 'paid')
    .reduce((sum, o) => sum + o.total, 0)

  return {
    authed: true as const,
    user: { email: session.user.email },
    orders,
    subscribers,
    stats: {
      orderCount: orders.length,
      subscriberCount: subscribers.length,
      revenue,
    },
  }
})

// Lightweight session gate for admin pages that only need "are we the
// logged-in admin?" (account / security), without the dashboard payload.
export const getAdminSession = createServerFn({ method: 'GET' }).handler(async () => {
  await ensureDb()
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return { authed: false as const }
  return { authed: true as const, user: { email: session.user.email } }
})
