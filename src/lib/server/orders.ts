import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth'
import { getPool } from '../db'
import { ensureDb } from '../migrate'
import { indexOrder } from './search'

export type PublicOrder = {
  id: string
  customer_name: string
  items: { id: string; name: string; qty: number; price: number }[]
  total: number
  currency: string
  status: string
  created_at: string
  delivered_at: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function isAdmin(): Promise<boolean> {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  return Boolean(session?.user)
}

/* ------------------------------------------------------------------ *
 * getOrderPublic — the permanent, link-by-id order view.
 *
 * Looked up by the unguessable order UUID (the QR target), so it needs
 * no auth to READ. We return only customer-safe fields (no email). We
 * also report whether the *current* viewer is the logged-in admin, so
 * the same page can surface a "mark delivered" control when an admin
 * scans the QR.
 * ------------------------------------------------------------------ */
export const getOrderPublic = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(
    async ({
      data: id,
    }): Promise<
      | { found: false; isAdmin: boolean }
      | { found: true; order: PublicOrder; isAdmin: boolean }
    > => {
      await ensureDb()
      const admin = await isAdmin()
      if (!UUID_RE.test(id)) return { found: false, isAdmin: admin }
      const res = await getPool().query(
        `SELECT id, customer_name, items, total, currency, status, created_at, delivered_at
         FROM orders WHERE id = $1 LIMIT 1`,
        [id],
      )
      if (!res.rowCount) return { found: false, isAdmin: admin }
      return { found: true, order: res.rows[0] as PublicOrder, isAdmin: admin }
    },
  )

/* ------------------------------------------------------------------ *
 * markOrderDelivered — admin-gated. Stamps delivered_at once (idempotent:
 * a second scan won't overwrite the original delivery time). Returns the
 * updated row so the UI can flip without a full reload.
 * ------------------------------------------------------------------ */
export const markOrderDelivered = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await ensureDb()
    if (!(await isAdmin())) return { ok: false as const, authed: false as const }
    if (!UUID_RE.test(data.id)) return { ok: false as const, authed: true as const }
    const res = await getPool().query(
      `UPDATE orders
         SET delivered_at = COALESCE(delivered_at, now())
       WHERE id = $1
       RETURNING delivered_at`,
      [data.id],
    )
    if (!res.rowCount) return { ok: false as const, authed: true as const }
    void indexOrder(data.id) // reflect delivered state in search
    return {
      ok: true as const,
      authed: true as const,
      delivered_at: res.rows[0].delivered_at as string,
    }
  })
