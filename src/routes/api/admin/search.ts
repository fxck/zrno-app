import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../lib/auth'
import { searchAdmin } from '../../../lib/server/search'

/* Admin-gated search endpoint backing the ⌘K palette. Keeping this as a
 * plain API route (not a server fn imported by the client) means the
 * Meilisearch client + better-auth never reach the browser bundle. */
export const Route = createFileRoute('/api/admin/search')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session?.user) {
          return Response.json({ authed: false }, { status: 401 })
        }
        const q = new URL(request.url).searchParams.get('q') ?? ''
        const res = await searchAdmin(q)
        return Response.json({ authed: true, ...res })
      },
    },
  },
})
