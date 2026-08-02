'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdmin } from '@/contexts/AdminContext'
import { adminFetch } from '@/lib/admin-client'
import type { AdminRow } from '@/app/api/admin/admins/route'
import type { AdminInviteRow } from '@/app/api/admin/invites/route'
import type { AdminUserRow } from '@/app/api/admin/users/route'
import { REGIONS } from '@/lib/challenges'
import { Button } from '@/components/ui/Button'
import { canonicalOrigin } from '@/lib/migration'

export default function AdminAdminsPage() {
  const { state, reportFailure } = useAdmin()
  const [admins, setAdmins] = useState<AdminRow[] | null>(null)
  const [invites, setInvites] = useState<AdminInviteRow[]>([])
  const [pax, setPax] = useState<AdminUserRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const fail = useCallback((e: unknown) => {
    reportFailure(e)
    setError(e instanceof Error ? e.message : 'Failed')
  }, [reportFailure])

  // Invite form
  const [regionId, setRegionId] = useState(REGIONS[0]?.id ?? '')
  const [linkedPax, setLinkedPax] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    Promise.all([
      adminFetch<{ admins: AdminRow[] }>('/api/admin/admins'),
      adminFetch<{ invites: AdminInviteRow[] }>('/api/admin/invites'),
      adminFetch<{ users: AdminUserRow[] }>('/api/admin/users'),
    ])
      .then(([a, i, u]) => {
        setAdmins(a.admins)
        setInvites(i.invites)
        setPax(u.users)
      })
      .catch(fail)
  }, [fail])

  useEffect(() => { if (state.status === 'ready') load() }, [state.status, load])

  async function createInvite() {
    setBusy('create')
    setError(null)
    setCreated(null)
    try {
      const res = await adminFetch<{ token: string }>('/api/admin/invites', {
        method: 'POST',
        body: JSON.stringify({
          role: 'regionAdmin',
          regionIds: [regionId],
          ...(linkedPax ? { userId: linkedPax } : {}),
        }),
      })
      setCreated(`${canonicalOrigin()}/admin/claim?t=${res.token}`)
      setLinkedPax('')
      load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  async function revokeInvite(token: string) {
    setBusy(token)
    try {
      await adminFetch(`/api/admin/invites/${token}`, { method: 'DELETE' })
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Admins</h1>
        <p className="text-sm text-zinc-500">
          Invite someone by sending them a link. Whichever Google account opens it becomes
          the admin — nothing to type, nothing to misspell.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Create invite ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <p className="text-white font-semibold text-sm">New region admin</p>

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
          Linking a PAX makes the audit log read “Babe archived Hot Keys” rather than an
          email address, and stops them archiving their own account by accident.
        </p>

        <Button variant="primary" size="sm" onClick={createInvite} loading={busy === 'create'}>
          Create invite link
        </Button>

        {created && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
            <p className="text-xs text-orange-300">
              Send this to them. It works once and expires in 7 days.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-zinc-300 break-all bg-zinc-950 rounded px-2 py-1.5">
                {created}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(created)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Pending invites ───────────────────────────────────────────── */}
      {invites.length > 0 && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">Unclaimed invites</p>
          <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
            {invites.map(inv => (
              <div key={inv.token} className="flex items-center gap-3 px-4 py-3 bg-zinc-900">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    {inv.paxName ?? 'Unlinked'}{' · '}
                    <span className="text-zinc-500">{inv.regionIds.join(', ') || inv.role}</span>
                  </p>
                  <p className="text-xs text-zinc-600">
                    {inv.expired
                      ? 'Expired'
                      : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeInvite(inv.token)}
                  loading={busy === inv.token}
                >
                  Revoke
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
