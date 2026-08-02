'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdmin } from '@/contexts/AdminContext'
import { adminFetch } from '@/lib/admin-client'
import type { AdminRow } from '@/app/api/admin/admins/route'
import type { AdminDesignationRow } from '@/app/api/admin/designations/route'
import type { AdminUserRow } from '@/app/api/admin/users/route'
import { REGIONS } from '@/lib/challenges'
import { Button } from '@/components/ui/Button'

export default function AdminAdminsPage() {
  const { state, reportFailure } = useAdmin()
  const [admins, setAdmins] = useState<AdminRow[] | null>(null)
  const [designations, setDesignations] = useState<AdminDesignationRow[]>([])
  const [pax, setPax] = useState<AdminUserRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const fail = useCallback((e: unknown) => {
    reportFailure(e)
    setError(e instanceof Error ? e.message : 'Failed')
  }, [reportFailure])

  // Designation form
  const [email, setEmail] = useState('')
  const [regionId, setRegionId] = useState(REGIONS[0]?.id ?? '')
  const [linkedPax, setLinkedPax] = useState('')

  const load = useCallback(() => {
    Promise.all([
      adminFetch<{ admins: AdminRow[] }>('/api/admin/admins'),
      adminFetch<{ designations: AdminDesignationRow[] }>('/api/admin/designations'),
      adminFetch<{ users: AdminUserRow[] }>('/api/admin/users'),
    ])
      .then(([a, d, u]) => {
        setAdmins(a.admins)
        setDesignations(d.designations)
        setPax(u.users)
      })
      .catch(fail)
  }, [fail])

  useEffect(() => { if (state.status === 'ready') load() }, [state.status, load])

  async function designate() {
    setBusy('create')
    setError(null)
    try {
      await adminFetch('/api/admin/designations', {
        method: 'POST',
        body: JSON.stringify({
          email,
          role: 'regionAdmin',
          regionIds: [regionId],
          ...(linkedPax ? { userId: linkedPax } : {}),
        }),
      })
      setEmail('')
      setLinkedPax('')
      load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  async function withdraw(id: string) {
    setBusy(id)
    try {
      await adminFetch(`/api/admin/designations/${id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      fail(e)
    } finally { setBusy(null) }
  }

  async function linkSelf(userId: string | null) {
    setBusy('link')
    setError(null)
    try {
      await adminFetch('/api/admin/admins/link', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      load()
    } catch (e) {
      fail(e)
    } finally { setBusy(null) }
  }

  async function revokeAdmin(row: AdminRow) {
    const who = row.paxName ?? row.email
    if (!confirm(`Revoke admin access for ${who}?\n\nThey lose access immediately — no waiting for a session to expire.`)) return
    setBusy(row.uid)
    try {
      await adminFetch(`/api/admin/admins/${row.uid}`, { method: 'DELETE' })
      load()
    } catch (e) {
      fail(e)
    } finally { setBusy(null) }
  }

  if (state.status !== 'ready') return null

  const paxForRegion = pax.filter(p => p.regionId === regionId && p.status !== 'archived')
  const me = admins?.find(a => a.isSelf)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Admins</h1>
        <p className="text-sm text-zinc-500">
          Designate someone by their Google email address. They become an admin the first
          time they sign in here — there&apos;s nothing to send them.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Link your own PAX account ──────────────────────────────────── */}
      {me && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <p className="text-white font-semibold text-sm">Your PAX account</p>
          <p className="text-xs text-zinc-500">
            Linking tells the app you&apos;re an admin without signing in on every device —
            the admin menu and moderation controls then show up wherever you&apos;re signed
            in as a PAX. It also makes the audit log read your F3 name instead of your
            email. Bootstrap can&apos;t work this out on its own: a Google account says
            nothing about which F3 name you post under.
          </p>
          <select
            value={me.userId ?? ''}
            onChange={e => linkSelf(e.target.value || null)}
            disabled={busy === 'link'}
            className="w-full sm:w-72 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white px-3 py-2"
          >
            <option value="">Not linked</option>
            {pax.filter(p => p.status !== 'archived').map(p => (
              <option key={p.id} value={p.id}>
                {p.displayName} · {p.regionId}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Designate an admin ────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <p className="text-white font-semibold text-sm">New region admin</p>

        <label className="block">
          <span className="text-xs text-zinc-500 block mb-1">Google email address</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="them@gmail.com"
            autoComplete="off"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white px-3 py-2 placeholder:text-zinc-700"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-zinc-500 block mb-1">Region</span>
            <select
              value={regionId}
              onChange={e => { setRegionId(e.target.value); setLinkedPax('') }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white px-3 py-2"
            >
              {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500 block mb-1">Which PAX is this? (optional)</span>
            <select
              value={linkedPax}
              onChange={e => setLinkedPax(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white px-3 py-2"
            >
              <option value="">Not a PAX here</option>
              {paxForRegion.map(p => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-zinc-600">
          Linking a PAX puts the Admin menu in their app straight away, before they sign in
          — usually how they find out. It also makes the audit log read “Babe archived Hot
          Keys” rather than an email address, and stops them archiving their own account by
          accident.
        </p>

        <Button
          variant="primary"
          size="sm"
          onClick={designate}
          loading={busy === 'create'}
          disabled={!email.trim()}
        >
          Designate admin
        </Button>
      </div>

      {/* ── Designated, not yet signed in ─────────────────────────────── */}
      {designations.length > 0 && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">Waiting on first sign-in</p>
          <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
            {designations.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {d.paxName ?? d.email}{' · '}
                    <span className="text-zinc-500">{d.regionIds.join(', ') || d.role}</span>
                  </p>
                  <p className="text-xs text-zinc-600 truncate">
                    {d.paxName ? `${d.email} · ` : ''}
                    Becomes an admin when they sign in with this address
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => withdraw(d.id)}
                  loading={busy === d.id}
                >
                  Withdraw
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Current admins ────────────────────────────────────────────── */}
      <div>
        <p className="text-sm text-zinc-400 mb-2">Admins</p>
        {admins === null ? (
          <p className="text-sm text-zinc-600">Loading…</p>
        ) : (
          <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
            {admins.map(a => (
              <div key={a.uid} className="flex items-center gap-3 px-4 py-3 bg-zinc-900">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {a.paxName ?? a.email}
                    {a.isSelf && <span className="text-zinc-600"> (you)</span>}
                  </p>
                  <p className="text-xs text-zinc-600 truncate">
                    {a.role === 'superadmin' ? 'Superadmin — every region' : a.regionIds.join(', ')}
                    {a.paxName && ` · ${a.email}`}
                  </p>
                </div>
                {!a.isSelf && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeAdmin(a)}
                    loading={busy === a.uid}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
