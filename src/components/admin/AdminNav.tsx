'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdmin } from '@/contexts/AdminContext'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/admin',        label: 'Overview', exact: true },
  { href: '/admin/users',  label: 'PAX' },
  { href: '/admin/feed',   label: 'Feed' },
  { href: '/admin/admins', label: 'Admins', superadminOnly: true },
]

export function AdminNav() {
  const pathname = usePathname()
  const { state, signOut } = useAdmin()
  if (state.status !== 'ready') return null

  const { record, email } = state.session
  const isSuper = record.role === 'superadmin'

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-black text-white shrink-0">Admin</span>
            <span
              className={cn(
                'text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold shrink-0',
                isSuper ? 'bg-orange-500/15 text-orange-400' : 'bg-zinc-800 text-zinc-400'
              )}
            >
              {isSuper ? 'Superadmin' : record.regionIds.join(', ') || 'No regions'}
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-zinc-600 truncate hidden sm:inline">{email}</span>
            <button
              onClick={signOut}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {LINKS.filter(l => !l.superadminOnly || isSuper).map(link => {
            const active = link.exact ? pathname === link.href : pathname?.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-orange-500 text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
