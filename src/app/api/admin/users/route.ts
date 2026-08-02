import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireAnyAdmin, adminErrorResponse } from '@/lib/admin-auth'
import { REGIONS, resolveRegion } from '@/lib/challenges'
import type { User } from '@/types'

/** How far back the activity stats look. Bounds the dailyLogs read and matches
 *  the question the screen is actually asking: is this PAX still showing up? */
const ACTIVITY_WINDOW_DAYS = 90

export interface AdminUserRow {
  id: string
  displayName: string
  regionId: string
  status: 'active' | 'archived'
  createdAt: string
  tokenCount: number
  /** Days logged within the activity window, not lifetime. */
  logCount: number
  lastActiveDate?: string
  archivedAt?: string
  /** So the UI can say what the count actually covers. */
  activityWindowDays: number
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
    const principal = await requireAnyAdmin(req)
    const { record } = principal

    const visibleRegionIds = record.role === 'superadmin'
      ? REGIONS.map(r => r.id)
      : record.regionIds
    if (visibleRegionIds.length === 0) return NextResponse.json({ users: [] })

    const usersSnap = await adminDb.collection('users').get()
    const users = usersSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<User, 'id'>) }))
      .filter(u => {
        // A superadmin sees everyone. A region admin sees only documents whose
        // region is explicitly theirs — resolveRegion() would silently map a
        // region-less doc to Bedrock, quietly handing it to whoever administers
        // Bedrock. Those belong to the superadmin to sort out.
        if (record.role === 'superadmin') return true
        return u.regionId !== undefined && visibleRegionIds.includes(u.regionId)
      })

    // One pass over dailyLogs rather than a query per PAX — the roster is small
    // but this endpoint would otherwise be N+1 forever.
    //
    // Windowed, because dailyLogs grows ~750/month forever and is never pruned:
    // an unbounded scan here would be ~10k reads per panel load within a year,
    // and five loads would eat the daily free quota. ACTIVITY_WINDOW_DAYS is
    // also the more useful question for this screen — "have they done anything
    // lately" is what decides whether someone should be archived, not what they
    // did last spring.
    const cutoff = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86400_000)
      .toISOString()
      .slice(0, 10)

    const logsSnap = await adminDb.collection('dailyLogs')
      .where('date', '>=', cutoff)
      .get()
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
        activityWindowDays: ACTIVITY_WINDOW_DAYS,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    return NextResponse.json({ users: rows })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
