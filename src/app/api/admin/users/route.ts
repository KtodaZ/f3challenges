import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireAdmin, adminErrorResponse } from '@/lib/admin-auth'
import { REGIONS, resolveRegion } from '@/lib/challenges'
import type { User } from '@/types'

export interface AdminUserRow {
  id: string
  displayName: string
  regionId: string
  status: 'active' | 'archived'
  createdAt: string
  tokenCount: number
  logCount: number
  lastActiveDate?: string
  archivedAt?: string
}

/**
 * GET /api/admin/users — the PAX list for the panel.
 *
 * A superadmin sees every region; a region admin sees only theirs. The region
 * set comes from the caller's admin record, never from a query parameter —
 * otherwise scoping is decoration.
 */
export async function GET(req: NextRequest) {
  try {
    // No regionId: this is a read across whatever the caller governs, and the
    // filtering below is what enforces scope.
    const principal = await requireAdmin(req)
    const { record } = principal

    const visibleRegionIds = record.role === 'superadmin'
      ? REGIONS.map(r => r.id)
      : record.regionIds
    if (visibleRegionIds.length === 0) return NextResponse.json({ users: [] })

    const usersSnap = await adminDb.collection('users').get()
    const users = usersSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<User, 'id'>) }))
      .filter(u => visibleRegionIds.includes(resolveRegion(u.regionId).id))

    // One pass over dailyLogs rather than a query per PAX — the roster is small
    // but this endpoint would otherwise be N+1 forever.
    const logsSnap = await adminDb.collection('dailyLogs').get()
    const logCount = new Map<string, number>()
    const lastActive = new Map<string, string>()
    for (const doc of logsSnap.docs) {
      const log = doc.data() as { userId?: string; date?: string }
      if (!log.userId) continue
      logCount.set(log.userId, (logCount.get(log.userId) ?? 0) + 1)
      if (log.date && (!lastActive.has(log.userId) || log.date > lastActive.get(log.userId)!)) {
        lastActive.set(log.userId, log.date)
      }
    }

    const rows: AdminUserRow[] = users
      .map(u => ({
        id: u.id,
        displayName: u.displayName,
        regionId: resolveRegion(u.regionId).id,
        status: (u.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
        createdAt: u.createdAt,
        tokenCount: u.fcmTokens?.length ?? 0,
        logCount: logCount.get(u.id) ?? 0,
        lastActiveDate: lastActive.get(u.id),
        archivedAt: u.archivedAt,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    return NextResponse.json({ users: rows })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
