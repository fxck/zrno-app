import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { authClient } from '../lib/auth-client'
import { Wordmark } from './bean-mark'
import { Button } from './ui/button'

/* ------------------------------------------------------------------ *
 * AdminShell — one chrome for every authenticated back-office page.
 *
 * Brand row (wordmark + signed-in email + sign-out) and a clickable nav
 * row that highlights the active section. Each page just drops its body
 * in as children, so Dashboard / Orders / Subscribers / Journal /
 * Security all share identical geometry and navigation.
 * ------------------------------------------------------------------ */

// Shop sections only. "Security" is account-level (lives next to the user).
const NAV = [
  { label: 'Dashboard', to: '/admin/dashboard' },
  { label: 'Orders', to: '/admin/orders' },
  { label: 'Subscribers', to: '/admin/subscribers' },
  { label: 'Journal', to: '/admin/journal' },
] as const

export function AdminShell({
  email,
  actions,
  children,
}: {
  email?: string
  /** right-aligned page actions (e.g. "New post") */
  actions?: ReactNode
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  async function logout() {
    await authClient.signOut()
    router.navigate({ to: '/admin' })
  }

  return (
    <div className="min-h-screen bg-espresso text-cream font-body">
      <header className="sticky top-0 z-40 border-b border-muted/15 bg-espresso/92 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 px-6 md:px-12 py-4">
          <div className="flex items-baseline gap-4">
            <Link to="/" aria-label="ZRNO home">
              <Wordmark className="text-xl text-cream" />
            </Link>
            <span className="font-mono text-[11px] tracking-[0.2em] text-taupe">
              BACK OFFICE
            </span>
          </div>
          {/* Account cluster — the user + their account-level controls
              (security) + sign-out, kept distinct from the shop nav below. */}
          <div className="flex items-center gap-4">
            {actions}
            <div className="flex items-center gap-3 border-l border-muted/15 pl-4">
              {email && (
                <span className="font-mono text-[11px] text-muted hidden md:inline">
                  {email}
                </span>
              )}
              <Link
                to="/admin/security"
                aria-label="Account security"
                className={[
                  'font-mono text-[11px] tracking-[0.18em] uppercase transition-colors',
                  pathname.startsWith('/admin/security')
                    ? 'text-cream'
                    : 'text-taupe hover:text-cream',
                ].join(' ')}
              >
                Security
              </Link>
              <Button variant="ghost" size="sm" onClick={logout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-4 md:px-10 -mb-px">
          {NAV.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(item.to + '/')
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  'relative whitespace-nowrap px-3 py-3 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors',
                  active ? 'text-cream' : 'text-taupe hover:text-cream',
                ].join(' ')}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-px bg-amber" />
                )}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="px-6 md:px-12 py-10">{children}</main>
    </div>
  )
}
