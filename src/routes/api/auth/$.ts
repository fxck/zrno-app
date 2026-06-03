import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../lib/auth'
import { ensureDb } from '../../../lib/migrate'

const handle = async ({ request }: { request: Request }) => {
  await ensureDb()
  return auth.handler(request)
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
})
