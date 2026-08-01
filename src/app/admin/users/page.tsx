'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdmin } from '@/contexts/AdminContext'
import { adminFetch } from '@/lib/admin-client'
import type { AdminUserRow } from '@/app/api/admin/users/route'
import { Button } from '@/components/ui/Button'
import { REGIONS } from '@/lib/challenges'
import { cn } from '@/lib/utils'

export default function AdminUsersPage() {
  const { state } = useAdmin()
  const [users, setUsers] = useState<AdminUserRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(() => {
    adminFetch<{ users: AdminUserRow[] }>('/api/admin/users')
      .then(r => setUsers(r.users))
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => { if (state.status === 'ready') load() }, [state.status, load])

  async function mutate(userId: string, body: Record<string, unknown>) {
    setBusyId(userId)
    setError(null)
    try {
      await adminFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  function handleArchive(u: AdminUserRow) {
    const warning = u.logCount > 0
      ? `${u.displayName} has ${u.logCount} logged day${u.logCount === 1 ? '' : 's'}. Archiving keeps all of it — they just leave the active crew. Continue?`
      : `Archive ${u.displayName}? They'll drop out of the leaderboard, mentions and reminders.`
    if (!confirm(warning)) return
    mutate(u.id, { action: 'archive' })
  }

  function handleRename(u: AdminUserRow) {
    const name = prompt(`New F3 name for ${u.displayName}:`, u.displayName)
    if (!name || name.trim() === u.displayName) return
    mutate(u.id, { action: 'rename', displayName: name.trim() })
  }

  if (state.status !== 'ready') return null

  // The PAX account this admin is, if their invite linked one. Archiving
  // yourself would drop you out of your own crew's leaderboard and reminders
  // while you're the one holding the panel — always a mistake, never intent.
  const ownPaxId = state.session.record.userId

  const visible = (users ?? []).filter(u =>
    (regionFilter === 'all' || u.regionId === regionFilter) &&
    (showArchived || u.status !== 'archived')
  )
  const archivedCount = (users ?? []).filter(u => u.status === 'archived').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">PAX</h1>
        <p className="text-sm text-zinc-500">
          Archiving removes someone from the leaderboard, name picker, @mention list and
          reminders. Nothing they logged or posted is deleted.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white px-3 py-1.5"
        >
          <option value="all">All regions</option>
          {REGIONS.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
            className="accent-orange-500"
          />
          Show archived{archivedCount > 0 && ` (${archivedCount})`}
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {users === null ? (
        <p className="text-sm text-zinc-600">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-zinc-600">No PAX match this filter.</p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
          {visible.map(u => (
            <div
              key={u.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 bg-zinc-900',
                u.status === 'archived' && 'opacity-60'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium truncate">{u.displayName}</p>
                  {u.id === ownPaxId && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 shrink-0">
                      You
                    </span>
                  )}
                  {u.status === 'archived' && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 mt-0.5">
                  {u.regionId} · {u.logCount} log{u.logCount === 1 ? '' : 's'} ·{' '}
                  {u.tokenCount > 0
                    ? `${u.tokenCount} device${u.tokenCount === 1 ? '' : 's'}`
                    : 'no push'}
                  {u.lastActiveDate ? ` · last ${u.lastActiveDate}` : ' · never logged'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRename(u)}
                  disabled={busyId === u.id}
                >
                  Rename
                </Button>
                {u.status === 'archived' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => mutate(u.id, { action: 'unarchive' })}
                    loading={busyId === u.id}
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleArchive(u)}
                    loading={busyId === u.id}
                    disabled={u.id === ownPaxId}
                    title={u.id === ownPaxId ? "That's you" : undefined}
                  >
                    Archive
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
