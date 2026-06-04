import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getAdminSession } from '../../lib/server/admin'
import { authClient } from '../../lib/auth-client'
import { AdminShell } from '../../components/admin-shell'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input, Label } from '../../components/ui/input'

export const Route = createFileRoute('/admin/security')({
  loader: async () => {
    const data = await getAdminSession()
    if (!data.authed) throw redirect({ to: '/admin' })
    return data
  },
  component: Security,
})

type Passkey = {
  id: string
  name?: string | null
  deviceType?: string | null
  createdAt: string | Date
}

function fmtDate(s: string | Date) {
  const d = new Date(s)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Security() {
  const { user } = Route.useLoaderData()

  return (
    <AdminShell email={user.email}>
      <div className="max-w-2xl mx-auto space-y-12">
        <div>
          <div className="font-mono text-xs tracking-[0.2em] text-amber uppercase">Account</div>
          <h1 className="font-display text-4xl md:text-5xl mt-3">SECURITY</h1>
          <p className="text-taupe mt-4 leading-relaxed">
            Change your password or add a passkey for faster, phishing-resistant
            sign-in.
          </p>
        </div>

        <ChangePassword />
        <Passkeys />
      </div>
    </AdminShell>
  )
}

/* ------------------------------------------------------------------ *
 * Change password
 * ------------------------------------------------------------------ */
function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [revokeOthers, setRevokeOthers] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (next.length < 8) {
      return setMsg({ kind: 'err', text: 'New password must be at least 8 characters.' })
    }
    if (next !== confirm) {
      return setMsg({ kind: 'err', text: 'New password and confirmation do not match.' })
    }
    setBusy(true)
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: revokeOthers,
    })
    setBusy(false)
    if (error) {
      return setMsg({ kind: 'err', text: error.message || 'Could not change password.' })
    }
    setMsg({ kind: 'ok', text: 'Password updated.' })
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  return (
    <section>
      <h2 className="font-display text-2xl">CHANGE PASSWORD</h2>
      <Card className="p-6 mt-4">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="next">New password</Label>
              <Input
                id="next"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-taupe cursor-pointer select-none">
            <input
              type="checkbox"
              checked={revokeOthers}
              onChange={(e) => setRevokeOthers(e.target.checked)}
              className="h-4 w-4 accent-amber"
            />
            Sign out other sessions
          </label>
          {msg && (
            <p className={msg.kind === 'ok' ? 'text-sm text-amber' : 'text-sm text-red-400'}>
              {msg.text}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Card>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Passkeys — list, add (WebAuthn registration), remove
 * ------------------------------------------------------------------ */
function Passkeys() {
  const [list, setList] = useState<Passkey[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function refresh() {
    const { data, error } = await authClient.passkey.listUserPasskeys()
    if (error) {
      setErr(error.message || 'Could not load passkeys.')
      setList([])
      return
    }
    setErr('')
    setList((data as Passkey[]) ?? [])
  }

  useEffect(() => {
    refresh()
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    // Triggers the browser's WebAuthn registration ceremony.
    const res = await authClient.passkey.addPasskey({ name: name.trim() || undefined })
    setBusy(false)
    if (res?.error) {
      setErr(res.error.message || 'Passkey registration was cancelled or failed.')
      return
    }
    setName('')
    await refresh()
  }

  async function remove(id: string) {
    setErr('')
    const { error } = await authClient.passkey.deletePasskey({ id })
    if (error) {
      setErr(error.message || 'Could not remove passkey.')
      return
    }
    await refresh()
  }

  return (
    <section>
      <h2 className="font-display text-2xl">PASSKEYS</h2>
      <p className="text-taupe text-sm mt-2 leading-relaxed">
        A passkey lets you sign in with your fingerprint, face, or device PIN —
        no password to type or phish.
      </p>

      <Card className="p-6 mt-4 space-y-6">
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="pk-name">Name this passkey (optional)</Label>
            <Input
              id="pk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MacBook Touch ID"
            />
          </div>
          <Button type="submit" disabled={busy} className="shrink-0">
            {busy ? 'Waiting for device…' : '+ Add a passkey'}
          </Button>
        </form>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="border-t border-muted/15 pt-5">
          {list === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted">No passkeys yet.</p>
          ) : (
            <ul className="space-y-3">
              {list.map((pk) => (
                <li
                  key={pk.id}
                  className="flex items-center justify-between gap-4 border-b border-muted/10 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-cream truncate">
                      {pk.name || 'Passkey'}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      Added {fmtDate(pk.createdAt)}
                      {pk.deviceType ? ` · ${pk.deviceType}` : ''}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(pk.id)}
                    className="shrink-0 text-muted hover:text-red-400"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  )
}
