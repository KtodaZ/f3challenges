import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'
import { generateId } from './utils'

/** Max videos allowed on a single feed post. */
export const MAX_FEED_VIDEOS = 3

/**
 * Hard ceiling on an uploaded video. Browsers can't reliably transcode video
 * client-side (unlike photos, which we downscale), so we upload as-is and just
 * refuse anything larger than the Storage rule allows (100 MB).
 */
const MAX_SOURCE_BYTES = 100 * 1024 * 1024 // 100 MB

/** Bound the getDownloadURL call so a hung browser API can't spin forever. */
const URL_TIMEOUT_MS = 15_000
/** If an upload makes no progress for this long, fail it instead of spinning. */
const STALL_TIMEOUT_MS = 45_000

// Lightweight remote logging (see CLAUDE.md "Debug Logging") so we can trace
// what happens on a real device — no-ops unless NEXT_PUBLIC_DEBUG_URL is set.
const DBG = process.env.NEXT_PUBLIC_DEBUG_URL
function dbg(label: string, data: unknown) {
  if (!DBG) return
  fetch(DBG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, src: 'feed-video-upload', data }),
  }).catch(() => {})
}

/** Reject `p` if it hasn't settled within `ms` — used to fence hangy browser APIs. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    p.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) }
    )
  })
}

export interface FeedVideoUpload {
  /** Resolves to the public download URL once the upload completes. */
  promise: Promise<string>
  /** Aborts the in-flight upload (e.g. the user removed the thumbnail). */
  cancel: () => void
}

/**
 * Upload a single video to Firebase Storage under `feed-videos/`. Reports
 * progress 0–100 as bytes transfer. Videos are keyed by a random id rather
 * than a post id so uploads can start the moment a file is picked, before the
 * post exists. Files in this prefix auto-expire after 1 year (bucket lifecycle).
 *
 * Unlike photos there is no client-side compression step — video re-encoding in
 * the browser isn't dependable — so the file is uploaded as picked, gated only
 * by a 100 MB size cap.
 */
export function uploadFeedVideo(
  file: File,
  onProgress?: (percent: number) => void
): FeedVideoUpload {
  let cancelled = false
  let cancelUpload: (() => void) | null = null

  const promise = (async () => {
    if (file.size > MAX_SOURCE_BYTES) {
      throw new Error('That video is too large (max 100 MB).')
    }
    if (cancelled) throw new Error('Upload cancelled')

    const contentType = file.type || 'video/mp4'
    let ext = (contentType.split('/')[1] || 'mp4').split(';')[0].toLowerCase()
    if (ext === 'quicktime') ext = 'mov'

    const path = `feed-videos/${generateId()}.${ext}`
    dbg('upload:start', { path, contentType, size: file.size, bucket: storage.app.options.storageBucket })
    const task = uploadBytesResumable(ref(storage, path), file, { contentType })
    cancelUpload = () => task.cancel()

    return await new Promise<string>((resolve, reject) => {
      let settled = false
      let stallTimer: ReturnType<typeof setTimeout>

      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(stallTimer)
        fn()
      }

      // Watchdog: if the upload never reports progress (the classic Firebase
      // Storage "stuck at 0%" when the bucket/rules aren't reachable), give up
      // with a real error instead of an eternal spinner. Re-armed on progress.
      const armStallTimer = () => {
        clearTimeout(stallTimer)
        stallTimer = setTimeout(() => {
          dbg('upload:stall', { path })
          finish(() => {
            try { task.cancel() } catch {}
            reject(new Error('Upload stalled — check your connection and try again.'))
          })
        }, STALL_TIMEOUT_MS)
      }
      armStallTimer()

      task.on(
        'state_changed',
        snap => {
          if (snap.totalBytes > 0) {
            onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100))
          }
          armStallTimer()
        },
        err => {
          dbg('upload:error', { code: (err as { code?: string })?.code, message: String(err) })
          finish(() => reject(err))
        },
        () => {
          finish(async () => {
            try {
              const url = await withTimeout(getDownloadURL(task.snapshot.ref), URL_TIMEOUT_MS, 'getDownloadURL')
              dbg('upload:done', { path })
              resolve(url)
            } catch (err) {
              reject(err)
            }
          })
        }
      )
    })
  })()

  return {
    promise,
    cancel: () => {
      cancelled = true
      cancelUpload?.()
    },
  }
}
