/**
 * Read and triage PAX feedback (Settings → Send Feedback).
 *
 * Built to be driven by a Claude routine: `list --json` emits one JSON array on
 * stdout and nothing else, so a loop is "list the new ones, work them, mark
 * each done with a note". Nothing else in the app reads or writes `status` —
 * this script owns the triage state.
 *
 * Usage:
 *   node scripts/feedback.mjs list                       # new items, human-readable
 *   node scripts/feedback.mjs list --status=all --json   # everything, machine-readable
 *   node scripts/feedback.mjs list --status=new --kind=bug --limit=10
 *   node scripts/feedback.mjs show <id>
 *   node scripts/feedback.mjs status <id> done --note="fixed in #52"
 *   node scripts/feedback.mjs status <id> triaged
 *
 * Statuses: new → triaged → done | wontfix
 *
 * Credentials come from .env.local (same vars as src/lib/firebase-admin.ts).
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))

const STATUSES = ['new', 'triaged', 'done', 'wontfix']

// ── Args ─────────────────────────────────────────────────────────────────────

const argv    = process.argv.slice(2)
const command = argv[0]
const flags   = Object.fromEntries(
  argv.filter(a => a.startsWith('--')).map(a => {
    const [k, ...rest] = a.slice(2).split('=')
    return [k, rest.length ? rest.join('=') : true]
  })
)
const positional = argv.filter(a => !a.startsWith('--'))

const USAGE = `Usage:
  node scripts/feedback.mjs list [--status=new|triaged|done|wontfix|all] [--kind=bug|idea|other]
                                 [--region=<id>] [--limit=N] [--json]
  node scripts/feedback.mjs show <id>
  node scripts/feedback.mjs status <id> <new|triaged|done|wontfix> [--note="..."]`

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`)
  console.error(USAGE)
  process.exit(msg ? 1 : 0)
}

// ── Credentials ──────────────────────────────────────────────────────────────

/**
 * Real environment first, then .env.local.
 *
 * The env-var path is what lets this run somewhere other than Kyle's laptop —
 * a scheduled cloud agent gets a bare git checkout with no .env.local in it,
 * so a file-only reader fails before it reads a single feedback item.
 */
function loadEnv() {
  let fromFile = {}
  try {
    const raw = readFileSync(join(__dirname, '../.env.local'), 'utf8')
    const get = key => raw.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')
    fromFile = {
      FIREBASE_PROJECT_ID:   get('FIREBASE_PROJECT_ID'),
      FIREBASE_CLIENT_EMAIL: get('FIREBASE_CLIENT_EMAIL'),
      FIREBASE_PRIVATE_KEY:  get('FIREBASE_PRIVATE_KEY'),
    }
  } catch {
    // No .env.local — expected off the laptop.
  }

  const get = key => process.env[key] || fromFile[key]
  const projectId   = get('FIREBASE_PROJECT_ID')
  const clientEmail = get('FIREBASE_CLIENT_EMAIL')
  // Escaped newlines survive both a dotenv line and a secrets manager field.
  const privateKey  = get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      'Missing Firebase Admin credentials.\n' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY as\n' +
      'environment variables, or put them in .env.local for local runs.'
    )
    process.exit(1)
  }
  return { projectId, clientEmail, privateKey }
}

initializeApp({ credential: cert(loadEnv()) })
const db = getFirestore()

// ── Commands ─────────────────────────────────────────────────────────────────

const KIND_ICON = { bug: '🐛', idea: '💡', other: '💬' }

async function list() {
  const status = flags.status ?? 'new'
  const limit  = Number(flags.limit ?? 100)
  if (status !== 'all' && !STATUSES.includes(status)) usage(`unknown --status=${status}`)

  // Ordered client-side: a where+orderBy pair would need a composite index for
  // every status/kind combination, and this collection is small.
  const snap = await db.collection('feedback').get()
  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (status !== 'all') items = items.filter(i => (i.status ?? 'new') === status)
  if (flags.kind)       items = items.filter(i => i.kind === flags.kind)
  if (flags.region)     items = items.filter(i => i.regionId === flags.region)
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  items = items.slice(0, limit)

  if (flags.json) {
    console.log(JSON.stringify(items, null, 2))
    return
  }

  if (!items.length) {
    console.log(`No feedback with status "${status}".`)
    return
  }
  for (const i of items) {
    const when = String(i.createdAt).slice(0, 16).replace('T', ' ')
    console.log(`\n${KIND_ICON[i.kind] ?? '•'}  ${i.id}   [${i.status ?? 'new'}]`)
    console.log(`   ${i.userName} · ${i.regionId ?? '?'} · ${when} · ${i.context?.path ?? '?'}`)
    console.log(`   ${i.message.replace(/\n/g, '\n   ')}`)
    if (i.triageNote) console.log(`   ↳ ${i.triageNote}`)
  }
  console.log(`\n${items.length} item(s).`)
}

async function show() {
  const id = positional[1]
  if (!id) usage('show needs an id')
  const snap = await db.collection('feedback').doc(id).get()
  if (!snap.exists) usage(`no feedback with id ${id}`)
  console.log(JSON.stringify({ id: snap.id, ...snap.data() }, null, 2))
}

async function setStatus() {
  const [, id, status] = positional
  if (!id || !status) usage('status needs an id and a status')
  if (!STATUSES.includes(status)) usage(`status must be one of ${STATUSES.join(', ')}`)

  const ref  = db.collection('feedback').doc(id)
  const snap = await ref.get()
  if (!snap.exists) usage(`no feedback with id ${id}`)

  const update = { status }
  if (typeof flags.note === 'string') update.triageNote = flags.note
  if (status === 'done' || status === 'wontfix') update.resolvedAt = new Date().toISOString()
  await ref.update(update)
  console.log(`${id} → ${status}${update.triageNote ? ` (${update.triageNote})` : ''}`)
}

const commands = { list, show, status: setStatus }

if (!command || !commands[command]) usage(command ? `unknown command "${command}"` : null)
await commands[command]()
