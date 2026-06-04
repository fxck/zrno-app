import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../lib/auth'
import { reindexAllNow } from '../../../lib/server/search'

/* Admin-gated full reindex — the palette's "Reindex" safety valve. */
export const Route = createFileRoute('/api/admin/reindex')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session?.user) {
          return Response.json({ authed: false }, { status: 401 })
        }
        const res = await reindexAllNow()
        return Response.json({ authed: true, ...res })
      },
    },
  },
})
