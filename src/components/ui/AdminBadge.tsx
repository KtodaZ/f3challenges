import { cn } from '@/lib/utils'
import type { AdminRole } from '@/lib/admin-auth'

interface AdminBadgeProps {
  /** Undefined for everyone who isn't an admin — the badge renders nothing,
   *  so call sites don't each need the same guard. */
  role: AdminRole | undefined
  size?: 'xs' | 'sm'
  className?: string
}

/**
 * The ADMIN tag beside a name in the feed.
 *
 * One label for both roles on purpose. The difference between a superadmin and
 * a region admin is about what the panel lets them do; to a PAX reading the
 * feed it's the same fact — this person runs things — and spelling out a
 * hierarchy in the middle of a workout post helps nobody.
 */
export function AdminBadge({ role, size = 'sm', className }: AdminBadgeProps) {
  if (!role) return null

  return (
    <span
      className={cn(
        'shrink-0 rounded-md border border-amber-500/30 bg-amber-500/15 font-bold uppercase tracking-wide text-amber-300',
        size === 'xs' ? 'px-1 py-px text-[9px]' : 'px-1.5 py-0.5 text-[10px]',
        className
      )}
      title={role === 'superadmin' ? 'Site admin' : 'Region admin'}
    >
      Admin
    </span>
  )
}
