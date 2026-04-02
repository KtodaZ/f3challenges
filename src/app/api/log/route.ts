import { NextRequest, NextResponse } from 'next/server'
import type { DailyLog, CompletionFraction } from '@/types'

// ─── POST /api/log ────────────────────────────────────────────────────────────
// Accepts a DailyLog payload, validates it, and writes it to Firestore.
// We use the server-side firebase-admin SDK path here; if only the client SDK
// is initialised in this project, the client-side upsertDailyLog can be called
// directly instead — this route provides an optional server boundary.

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const log = body as Partial<DailyLog>

  // Basic validation
  if (
    typeof log.id !== 'string' ||
    typeof log.userId !== 'string' ||
    typeof log.challengeId !== 'string' ||
    typeof log.date !== 'string' ||
    !Array.isArray(log.exerciseLogs)
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }

  const validFractions: CompletionFraction[] = [0, 0.25, 0.5, 0.75, 1]
  if (!validFractions.includes(log.completionFraction as CompletionFraction)) {
    return NextResponse.json({ error: 'Invalid completionFraction' }, { status: 422 })
  }

  // Date format check YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log.date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 422 })
  }

  // ID consistency check
  const expectedId = `${log.userId}_${log.date}`
  if (log.id !== expectedId) {
    return NextResponse.json({ error: 'ID mismatch' }, { status: 422 })
  }

  try {
    // Dynamic import so server-side firebase-admin or client SDK can be swapped
    // without changing this route's interface.
    const { upsertDailyLog } = await import('@/lib/firestore')

    const completeLog: DailyLog = {
      id: log.id,
      userId: log.userId,
      challengeId: log.challengeId,
      date: log.date,
      completionFraction: log.completionFraction as CompletionFraction,
      exerciseLogs: log.exerciseLogs,
      isMakeUp: log.isMakeUp ?? false,
      notes: log.notes,
      modificationNote: log.modificationNote,
      loggedAt: log.loggedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await upsertDailyLog(completeLog)

    return NextResponse.json({ ok: true, id: completeLog.id })
  } catch (err) {
    console.error('[POST /api/log]', err)
    return NextResponse.json({ error: 'Failed to save log' }, { status: 500 })
  }
}
