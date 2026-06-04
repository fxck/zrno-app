import { createFileRoute, redirect } from '@tanstack/react-router'
import { getDashboard } from '../../lib/server/admin'
import { AdminShell } from '../../components/admin-shell'
import { Card } from '../../components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table'
import { fmtDateTime } from '../../components/admin-bits'

export const Route = createFileRoute('/admin/subscribers')({
  loader: async () => {
    const data = await getDashboard()
    if (!data.authed) throw redirect({ to: '/admin' })
    return data
  },
  component: AdminSubscribers,
})

function AdminSubscribers() {
  const data = Route.useLoaderData()
  if (!data.authed) return null

  return (
    <AdminShell email={data.user.email}>
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-display text-4xl">SUBSCRIBERS</h1>
        <span className="font-mono text-[11px] text-muted">
          {data.subscribers.length} total
        </span>
      </div>

      <Card className="p-2">
        {data.subscribers.length === 0 ? (
          <p className="text-taupe text-sm p-6">No subscribers yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH className="text-right">Joined</TH>
              </TR>
            </THead>
            <TBody>
              {data.subscribers.map((s) => (
                <TR key={s.id}>
                  <TD>{s.email}</TD>
                  <TD className="text-right text-xs text-muted whitespace-nowrap">
                    {fmtDateTime(s.created_at)}
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
