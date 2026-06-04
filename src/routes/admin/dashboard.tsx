import { createFileRoute, redirect, useRouter, Link } from '@tanstack/react-router'
import { getDashboard } from '../../lib/server/admin'
import { authClient } from '../../lib/auth-client'
import { Card, CardHeader, CardTitle, CardValue } from '../../components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'

export const Route = createFileRoute('/admin/dashboard')({
  loader: async () => {
    const data = await getDashboard()
    if (!data.authed) throw redirect({ to: '/admin' })
    return data
  },
  component: Dashboard,
})

function fmtDate(s: string) {
  const d = new Date(s)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Dashboard() {
  const data = Route.useLoaderData()
  const router = useRouter()
  if (!data.authed) return null

  async function logout() {
    await authClient.signOut()
    router.navigate({ to: '/admin' })
  }

  return (
    <div className="min-h-screen bg-espresso text-cream font-body">
      <header className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-muted/15">
        <div className="flex items-baseline gap-4">
          <Link to="/" className="font-display text-2xl tracking-wider">
            ZRNO
          </Link>
          <span className="font-mono text-[11px] tracking-[0.2em] text-taupe">BACK OFFICE</span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            to="/admin/journal"
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-taupe hover:text-cream transition-colors"
          >
            Journal
          </Link>
          <Link
            to="/admin/security"
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-taupe hover:text-cream transition-colors"
          >
            Security
          </Link>
          <span className="font-mono text-[11px] text-muted hidden sm:inline">{data.user.email}</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="px-6 md:px-12 py-10 space-y-12">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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
        </section>

        <section>
          <Link to="/admin/journal" className="block group">
            <Card className="p-6 flex items-center justify-between hover:bg-elevated transition-colors">
              <div>
                <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-taupe">
                  Content
                </div>
                <div className="font-display text-3xl mt-2 text-cream">THE JOURNAL</div>
                <p className="text-taupe text-sm mt-1">Write and manage blog posts.</p>
              </div>
              <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-amber inline-flex items-center gap-2">
                Manage
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </span>
            </Card>
          </Link>
        </section>

        <section>
          <h2 className="font-display text-3xl mb-5">ORDERS</h2>
          <Card className="p-2">
            {data.orders.length === 0 ? (
              <p className="text-taupe text-sm p-6">No orders yet.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Items</TH>
                    <TH>Total</TH>
                    <TH>Status</TH>
                    <TH>Placed</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.orders.map((o) => (
                    <TR key={o.id}>
                      <TD className="font-mono text-xs text-taupe">#{o.id.slice(0, 8)}</TD>
                      <TD>
                        <div>{o.customer_name}</div>
                        <div className="text-xs text-muted">{o.email}</div>
                      </TD>
                      <TD className="text-taupe text-xs max-w-xs">
                        {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                      </TD>
                      <TD className="font-mono">{o.total} Kč</TD>
                      <TD>
                        <Badge variant={o.status === 'paid' ? 'paid' : o.status === 'failed' ? 'failed' : 'pending'}>
                          {o.status}
                        </Badge>
                      </TD>
                      <TD className="text-xs text-muted whitespace-nowrap">{fmtDate(o.created_at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </section>

        <section>
          <h2 className="font-display text-3xl mb-5">SUBSCRIBERS</h2>
          <Card className="p-2">
            {data.subscribers.length === 0 ? (
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
                  {data.subscribers.map((s) => (
                    <TR key={s.id}>
                      <TD>{s.email}</TD>
                      <TD className="text-xs text-muted whitespace-nowrap">{fmtDate(s.created_at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </section>
      </main>
    </div>
  )
}
