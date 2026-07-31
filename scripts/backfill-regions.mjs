/**
 * One-time backfill: stamp `regionId: 'bedrock'` on every document written
 * before regions existed.
 *
 * Everything in Firestore today belongs to F3 Bedrock, and the region-scoped
 * queries added in the multi-region change use equality filters — a document
 * with no `regionId` matches nothing and silently disappears from the app.
 * So this has to run BEFORE the multi-region build is deployed.
 *
 * Idempotent: documents that already carry a regionId are skipped, so it is
 * safe to re-run (and safe to run again after deploy to catch stragglers).
 *
 * Usage:
 *   node scripts/backfill-regions.mjs --dry-run     # report only, no writes
 *   node scripts/backfill-regions.mjs               # apply
 *   node scripts/backfill-regions.mjs --region=x    # target a different region
 *
 * Credentials come from .env.local (same vars as src/lib/firebase-admin.ts).
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Args ─────────────────────────────────────────────────────────────────────

const args     = process.argv.slice(2)
const dryRun   = args.includes('--dry-run')
const regionId = args.find(a => a.startsWith('--region='))?.split('=')[1] ?? 'bedrock'

// Top-level collections that carry a regionId. `feed` and `users` are the two
// that are actually queried by region; the rest are denormalized so a future
// inter-regional (shared) challenge doesn't need a second migration.
const COLLECTIONS = ['users', 'feed', 'dailyLogs', 'participation', 'bonusLogs']

// Firestore caps a batch at 500 writes.
const BATCH_SIZE = 400

// ── Credentials ──────────────────────────────────────────────────────────────

function loadEnv() {
  const raw = readFileSync(join(__dirname, '../.env.local'), 'utf8')
  const get = key => raw.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')
  const projectId   = get('FIREBASE_PROJECT_ID')
  const clientEmail = get('FIREBASE_CLIENT_EMAIL')
  const privateKey  = get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local')
    process.exit(1)
  }
  return { projectId, clientEmail, privateKey }
}

// ── Backfill ─────────────────────────────────────────────────────────────────

async function backfillCollection(db, name) {
  const snap = await db.collection(name).get()
  const needing = snap.docs.filter(d => !d.data().regionId)

  if (needing.length === 0) {
    console.log(`  ${name.padEnd(14)} ${snap.size} docs, 0 need regionId — skipped`)
    return { total: snap.size, updated: 0 }
  }

  if (dryRun) {
    console.log(`  ${name.padEnd(14)} ${snap.size} docs, ${needing.length} WOULD be set to '${regionId}'`)
    return { total: snap.size, updated: needing.length }
  }

  for (let i = 0; i < needing.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of needing.slice(i, i + BATCH_SIZE)) {
      batch.update(doc.ref, { regionId })
    }
    await batch.commit()
  }

  console.log(`  ${name.padEnd(14)} ${snap.size} docs, ${needing.length} set to '${regionId}'`)
  return { total: snap.size, updated: needing.length }
}

async function main() {
  const creds = loadEnv()
  initializeApp({ credential: cert(creds) })
  const db = getFirestore()

  console.log(`\nBackfilling regionId='${regionId}' on ${creds.projectId}`)
  console.log(dryRun ? '(DRY RUN — no writes)\n' : '(APPLYING WRITES)\n')

  let totalUpdated = 0
  for (const name of COLLECTIONS) {
    const { updated } = await backfillCollection(db, name)
    totalUpdated += updated
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${totalUpdated} documents.`)
  if (dryRun) console.log('Re-run without --dry-run to apply.\n')
}

main().catch(err => {
  console.error('\nBackfill failed:', err)
  process.exit(1)
})
