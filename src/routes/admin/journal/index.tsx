import { createFileRoute, redirect, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  listAllPosts,
  setPostStatus,
  deletePost,
  type PostListItem,
} from '../../../lib/server/blog'
import { AdminShell } from '../../../components/admin-shell'
import { fmtDate } from '../../../components/admin-bits'
import { Card } from '../../../components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '../../../components/ui/table'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import {
  useTableControls,
  TableToolbar,
  SortTH,
} from '../../../components/table-controls'

export const Route = createFileRoute('/admin/journal/')({
  loader: async () => {
    const data = await listAllPosts()
    if (!data.authed) throw redirect({ to: '/admin' })
    return data
  },
  component: AdminJournalList,
})

function AdminJournalList() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const posts = data.authed ? data.posts : []
  const controls = useTableControls<PostListItem>(posts, {
    searchText: (p) => `${p.title} ${p.slug} ${p.excerpt}`,
    sorts: [
      { key: 'updated_at', get: (p) => Date.parse(p.updated_at) },
      { key: 'title', get: (p) => p.title },
      { key: 'published_at', get: (p) => (p.published_at ? Date.parse(p.published_at) : null) },
    ],
    filters: [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'published', label: 'published' },
          { value: 'draft', label: 'draft' },
        ],
        test: (p, v) => p.status === v,
      },
    ],
    initialSort: { key: 'updated_at', dir: 'desc' },
  })
  if (!data.authed) return null

  async function toggleStatus(p: PostListItem) {
    setBusyId(p.id)
    const next = p.status === 'published' ? 'draft' : 'published'
    await setPostStatus({ data: { id: p.id, status: next } })
    setBusyId(null)
    router.invalidate()
  }

  async function remove(p: PostListItem) {
    if (!window.confirm(`Delete “${p.title}”? This cannot be undone.`)) return
    setBusyId(p.id)
    await deletePost({ data: { id: p.id } })
    setBusyId(null)
    router.invalidate()
  }

  return (
    <AdminShell
      actions={
        <Link to="/admin/journal/new">
          <Button size="sm">New post</Button>
        </Link>
      }
    >
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-display text-4xl">POSTS</h1>
        <span className="font-mono text-[11px] text-muted">{data.posts.length} total</span>
      </div>

      {data.posts.length > 0 && (
        <TableToolbar controls={controls} placeholder="Search posts by title, slug, excerpt…" />
      )}

      <Card className="p-2">
          {data.posts.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-taupe">No posts yet.</p>
              <Link to="/admin/journal/new" className="inline-block mt-4">
                <Button size="sm">Write the first one</Button>
              </Link>
            </div>
          ) : controls.rows.length === 0 ? (
            <p className="text-taupe text-sm p-6">No posts match these filters.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <SortTH controls={controls} sortKey="title">
                    Title
                  </SortTH>
                  <TH>Status</TH>
                  <SortTH controls={controls} sortKey="updated_at">
                    Updated
                  </SortTH>
                  <SortTH controls={controls} sortKey="published_at">
                    Published
                  </SortTH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {controls.rows.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link
                        to="/admin/journal/$id/edit"
                        params={{ id: p.id }}
                        className="font-medium text-cream hover:text-amber transition-colors"
                      >
                        {p.title}
                      </Link>
                      <div className="font-mono text-[11px] text-muted mt-0.5">/{p.slug}</div>
                    </TD>
                    <TD>
                      <Badge variant={p.status === 'published' ? 'paid' : 'pending'}>
                        {p.status}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-muted whitespace-nowrap">{fmtDate(p.updated_at)}</TD>
                    <TD className="text-xs text-muted whitespace-nowrap">
                      {fmtDate(p.published_at)}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2">
                        {p.status === 'published' && (
                          <Link to="/journal/$slug" params={{ slug: p.slug }} target="_blank">
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        )}
                        <Link to="/admin/journal/$id/edit" params={{ id: p.id }}>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => toggleStatus(p)}
                        >
                          {p.status === 'published' ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          disabled={busyId === p.id}
                          onClick={() => remove(p)}
                        >
                          Delete
                        </Button>
                      </div>
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
