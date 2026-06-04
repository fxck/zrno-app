import { createFileRoute } from '@tanstack/react-router'
import { ensureDb } from '../../lib/migrate'
import { getPool } from '../../lib/db'
import { sendWelcome } from '../../lib/email'
import { indexSubscriberByEmail } from '../../lib/server/search'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const Route = createFileRoute('/api/subscribe')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        await ensureDb()
        let email = ''
        try {
          const b = await request.json()
          email = String(b?.email ?? '').trim().toLowerCase()
        } catch {
          /* ignore */
        }
        if (!EMAIL_RE.test(email)) {
          return Response.json({ ok: false, error: 'Enter a valid email.' }, { status: 400 })
        }
        await getPool().query(
          'INSERT INTO subscribers(email) VALUES($1) ON CONFLICT (email) DO NOTHING',
          [email],
        )
        void indexSubscriberByEmail(email) // best-effort: make searchable
        await sendWelcome(email)
        return Response.json({ ok: true })
      },
    },
  },
})
