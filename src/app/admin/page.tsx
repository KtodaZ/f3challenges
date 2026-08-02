'use client'

import Link from 'next/link'
import { useAdmin } from '@/contexts/AdminContext'
import { REGIONS } from '@/lib/challenges'

export default function AdminOverviewPage() {
  const { state } = useAdmin()
  if (state.status !== 'ready') return null

  const { record } = state.session
  const isSuper = record.role === 'superadmin'
  const regions = isSuper ? REGIONS : REGIONS.filter(r => record.regionIds.includes(r.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Overview</h1>
        <p className="text-sm text-zinc-500">
          {isSuper
            ? 'You administer every region.'
            : `You administer ${regions.map(r => r.shortName).join(' and ') || 'no regions yet'}.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/users"
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors"
        >
          <p className="text-white font-semibold mb-1">PAX</p>
          <p className="text-xs text-zinc-500">
            Archive a dormant account, fix an F3 name.
          </p>
        </Link>
        <Link
          href="/admin/feed"
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors"
        >
          <p className="text-white font-semibold mb-1">Feed</p>
          <p className="text-xs text-zinc-500">
            Remove a post or comment.
          </p>
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          <span className="text-zinc-300 font-medium">Archiving isn&apos;t a lock.</span>{' '}
          PAX don&apos;t sign in — the app trusts whoever taps a name. Archiving
          removes someone from rosters, counts and reminders, and stops the app
          working on their phone. It can&apos;t stop a determined person from
          writing to the database directly. Every action here is recorded.
        </p>
      </div>
    </div>
  )
}
