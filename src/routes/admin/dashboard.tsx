import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { getDashboard } from '../../lib/server/admin'
import { AdminShell } from '../../components/admin-shell'
import { Card, CardHeader, CardTitle, CardValue } from '../../components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { OrderStatus, fmtDateTime } from '../../components/admin-bits'

export const Route = createFileRoute('/admin/dashboard')({
  loader: async () => {
    const data = await getDashboard()
    if (!data.authed) throw redirect({ to: '/admin' })
    return data
  },
  component: Dashboard,
})

function Dashboard() {
  const data = Route.useLoaderData()
  if (!data.authed) return null

  const toDeliver = data.orders.filter(
    (o) => o.status === 'paid' && !o.delivered_at,
  ).length
  const recentOrders = data.orders.slice(0, 6)
  const recentSubs = data.subscribers.slice(0, 6)

  return (
    <AdminShell email={data.user.email}>
      <div className="space-y-10">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardValue>{data.stats.orderCount}</CardValue>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Subscribers</CardTitle>
              <CardValue>{data.stats.subscriberCount}</CardValue>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue (paid)</CardTitle>
              <CardValue className="text-amber">{data.stats.revenue} Kč</CardValue>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>To deliver</CardTitle>
              <CardValue className={toDeliver ? 'text-emerald-400' : undefined}>
                {toDeliver}
              </CardValue>
            </CardHeader>
          </Card>
        </section>

        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-display text-3xl">RECENT ORDERS</h2>
            <Link
              to="/admin/orders"
              className="font-mono text-[11px] tracking-[0.18em] uppercase text-amber hover:text-amberdeep transition-colors"
            >
              View all →
            </Link>
          </div>
          <Card className="p-2">
            {recentOrders.length === 0 ? (
              <p className="text-taupe text-sm p-6">No orders yet.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Total</TH>
                    <TH>Status</TH>
                    <TH>Placed</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentOrders.map((o) => (
                    <TR key={o.id}>
                      <TD className="font-mono text-xs">
                        <Link
                          to="/o/$id"
                          params={{ id: o.id }}
                          className="text-taupe hover:text-amber transition-colors"
                        >
                          #{o.id.slice(0, 8)}
                        </Link>
                      </TD>
                      <TD>
                        <div>{o.customer_name}</div>
                        <div className="text-xs text-muted">{o.email}</div>
                      </TD>
                      <TD className="font-mono">{o.total} Kč</TD>
                      <TD>
                        <OrderStatus status={o.status} deliveredAt={o.delivered_at} />
                      </TD>
                      <TD className="text-xs text-muted whitespace-nowrap">
                        {fmtDateTime(o.created_at)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </section>

        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-display text-3xl">RECENT SUBSCRIBERS</h2>
            <Link
              to="/admin/subscribers"
              className="font-mono text-[11px] tracking-[0.18em] uppercase text-amber hover:text-amberdeep transition-colors"
            >
              View all →
            </Link>
          </div>
          <Card className="p-2">
            {recentSubs.length === 0 ? (
              <p className="text-taupe text-sm p-6">No subscribers yet.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Email</TH>
                    <TH>Joined</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentSubs.map((s) => (
                    <TR key={s.id}>
                      <TD>{s.email}</TD>
                      <TD className="text-xs text-muted whitespace-nowrap">
                        {fmtDateTime(s.created_at)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </section>
      </div>
    </AdminShell>
  )
}
