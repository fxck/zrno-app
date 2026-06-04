import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../../lib/auth-client'
import { Button } from '../../components/ui/button'
import { Input, Label } from '../../components/ui/input'

export const Route = createFileRoute('/admin/')({ component: AdminLogin })

function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pkBusy, setPkBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await authClient.signIn.email({ email, password })
    setBusy(false)
    if (error) {
      setError(error.message || 'Invalid credentials.')
      return
    }
    router.navigate({ to: '/admin/dashboard' })
  }

  async function signInWithPasskey() {
    setPkBusy(true)
    setError('')
    // Triggers the browser's WebAuthn ceremony; resolves with an error on
    // cancel or if no passkey is registered for this site.
    const res = await authClient.signIn.passkey()
    setPkBusy(false)
    if (res?.error) {
      setError(res.error.message || 'No passkey available for this site.')
      return
    }
    router.navigate({ to: '/admin/dashboard' })
  }

  return (
    <div className="min-h-screen bg-espresso text-cream font-body flex flex-col">
      <header className="px-6 md:px-14 py-5">
        <Link to="/" className="font-display text-2xl tracking-wider">
          ZRNO
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="font-mono text-xs tracking-[0.2em] text-amber text-center">ADMIN</div>
          <h1 className="font-display text-5xl text-center mt-3 mb-10">BACK OFFICE</h1>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6 text-[11px] font-mono tracking-[0.2em] text-muted">
            <span className="h-px flex-1 bg-muted/20" />
            OR
            <span className="h-px flex-1 bg-muted/20" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={signInWithPasskey}
            disabled={pkBusy}
          >
            {pkBusy ? 'Waiting for device…' : 'Sign in with a passkey'}
          </Button>
        </div>
      </main>
    </div>
  )
}
