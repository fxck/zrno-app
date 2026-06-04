import { createFileRoute, redirect } from '@tanstack/react-router'
import { getDashboard } from '../../lib/server/admin'
import { AdminShell } from '../../components/admin-shell'
import { Card } from '../../components/ui/card'
import { Table, THead, TBody, TR, TD } from '../../components/ui/table'
import { fmtDateTime } from '../../components/admin-bits'
import {
  useTableControls,
  TableToolbar,
  SortTH,
} from '../../components/table-controls'
import type { Subscriber } from '../../lib/server/admin'

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
  const subscribers = data.authed ? data.subscribers : []
  const controls = useTableControls<Subscriber>(subscribers, {
    searchText: (s) => s.email,
    sorts: [
      { key: 'created_at', get: (s) => Date.parse(s.created_at) },
      { key: 'email', get: (s) => s.email },
    ],
    initialSort: { key: 'created_at', dir: 'desc' },
  })
  if (!data.authed) return null

  return (
    <AdminShell email={data.user.email}>
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-display text-4xl">SUBSCRIBERS</h1>
        <span className="font-mono text-[11px] text-muted">
          {data.subscribers.length} total
        </span>
      </div>

      {data.subscribers.length > 0 && (
        <TableToolbar controls={controls} placeholder="Search subscribers by email…" />
      )}

      <Card className="p-2">
        {data.subscribers.length === 0 ? (
          <p className="text-taupe text-sm p-6">No subscribers yet.</p>
        ) : controls.rows.length === 0 ? (
          <p className="text-taupe text-sm p-6">No subscribers match your search.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <SortTH controls={controls} sortKey="email">
                  Email
                </SortTH>
                <SortTH controls={controls} sortKey="created_at" className="text-right">
                  Joined
                </SortTH>
              </TR>
            </THead>
            <TBody>
              {controls.rows.map((s) => (
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
