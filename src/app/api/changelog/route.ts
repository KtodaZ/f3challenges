import { NextResponse } from 'next/server'
import { getRecentChangelog } from '@/lib/changelog'

// force-dynamic so this reflects the freshly-deployed server's changelog, not a
// build-time snapshot. The update modal fetches this so it can show the NEW
// release's notes while the browser is still running the old bundle.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ entries: getRecentChangelog() })
}
