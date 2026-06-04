import { createFileRoute, redirect, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getDashboard } from '../../lib/server/admin'
import { markOrderDelivered } from '../../lib/server/orders'
import { AdminShell } from '../../components/admin-shell'
import { Card } from '../../components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { OrderStatus, fmtDateTime } from '../../components/admin-bits'
import {
  useTableControls,
  TableToolbar,
  TableCount,
  SortTH,
} from '../../components/table-controls'
import type { Order } from '../../lib/server/admin'

export const Route = createFileRoute('/admin/orders')({
  loader: async () => {
    const data = await getDashboard()
    if (!data.authed) throw redirect({ to: '/admin' })
    return data
  },
  component: AdminOrders,
})

function AdminOrders() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const orders = data.authed ? data.orders : []
  const controls = useTableControls<Order>(orders, {
    searchText: (o) =>
      `#${o.id.slice(0, 8)} ${o.customer_name} ${o.email} ${o.items
        .map((i) => i.name)
        .join(' ')} ${o.status}`,
    sorts: [
      { key: 'created_at', get: (o) => Date.parse(o.created_at) },
      { key: 'customer_name', get: (o) => o.customer_name },
      { key: 'total', get: (o) => o.total },
      { key: 'status', get: (o) => o.status },
    ],
    filters: [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'paid', label: 'paid' },
          { value: 'pending', label: 'pending' },
          { value: 'failed', label: 'failed' },
        ],
        test: (o, v) => o.status === v,
      },
      {
        key: 'delivery',
        label: 'Delivery',
        options: [
          { value: 'delivered', label: 'delivered' },
          { value: 'open', label: 'open' },
        ],
        test: (o, v) => (v === 'delivered' ? !!o.delivered_at : !o.delivered_at),
      },
    ],
    initialSort: { key: 'created_at', dir: 'desc' },
  })
  if (!data.authed) return null

  async function deliver(id: string) {
    setBusyId(id)
    await markOrderDelivered({ data: { id } })
    setBusyId(null)
    router.invalidate()
  }

  return (
    <AdminShell email={data.user.email}>
      <div className="mb-6 flex items-center gap-4">
        <h1 className="font-display text-4xl">ORDERS</h1>
        {data.orders.length > 0 && <TableCount controls={controls} />}
      </div>

      {data.orders.length > 0 && (
        <TableToolbar controls={controls} placeholder="Search orders — #id, name, email, item…" />
      )}

      <Card className="p-2">
        {data.orders.length === 0 ? (
          <p className="text-taupe text-sm p-6">No orders yet.</p>
        ) : controls.rows.length === 0 ? (
          <p className="text-taupe text-sm p-6">No orders match these filters.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Order</TH>
                <SortTH controls={controls} sortKey="customer_name">
                  Customer
                </SortTH>
                <TH>Items</TH>
                <SortTH controls={controls} sortKey="total">
                  Total
                </SortTH>
                <SortTH controls={controls} sortKey="status">
                  Status
                </SortTH>
                <SortTH controls={controls} sortKey="created_at">
                  Placed
                </SortTH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {controls.rows.map((o) => (
                <TR key={o.id}>
                  <TD className="font-mono text-xs">
                    <Link
                      to="/o/$id"
                      params={{ id: o.id }}
                      target="_blank"
                      className="text-taupe hover:text-amber transition-colors"
                    >
                      #{o.id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>
                    <div>{o.customer_name}</div>
                    <div className="text-xs text-muted">{o.email}</div>
                  </TD>
                  <TD className="text-taupe text-xs max-w-xs">
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                  </TD>
                  <TD className="font-mono whitespace-nowrap">{o.total} Kč</TD>
                  <TD>
                    <OrderStatus status={o.status} deliveredAt={o.delivered_at} />
                  </TD>
                  <TD className="text-xs text-muted whitespace-nowrap">
                    {fmtDateTime(o.created_at)}
                  </TD>
                  <TD className="text-right">
                    {o.delivered_at ? (
                      <span className="font-mono text-[11px] text-muted whitespace-nowrap">
                        {fmtDateTime(o.delivered_at)}
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === o.id}
                        onClick={() => deliver(o.id)}
                      >
                        {busyId === o.id ? 'Marking…' : 'Mark delivered'}
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </AdminShell>
  )
}
