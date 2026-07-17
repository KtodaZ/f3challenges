import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'
import { generateId } from './utils'

/** Max images allowed on a single feed post. */
export const MAX_FEED_IMAGES = 8

/** Reject anything a phone camera wouldn't reasonably produce. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024 // 25 MB before compression

/** Bound each in-browser compression step so a stuck decode can't hang forever. */
const COMPRESS_TIMEOUT_MS = 15_000
/** If an upload makes no progress for this long, fail it instead of spinning. */
const STALL_TIMEOUT_MS = 30_000

// Lightweight remote logging (see CLAUDE.md "Debug Logging") so we can trace
// what happens on a real device — no-ops unless NEXT_PUBLIC_DEBUG_URL is set.
const DBG = process.env.NEXT_PUBLIC_DEBUG_URL
function dbg(label: string, data: unknown) {
  if (!DBG) return
  fetch(DBG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, src: 'feed-upload', data }),
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

/**
 * Downscale + re-encode an image entirely in the browser before upload.
 *
 * Resizes so the longest edge is at most `maxDim`, re-encodes as JPEG, and
 * bakes in EXIF orientation (`imageOrientation: 'from-image'`) so portrait
 * phone photos aren't rendered sideways. Re-encoding to JPEG also sidesteps
 * iOS HEIC files that desktop browsers can't display.
 *
 * Best-effort: if the browser can't decode the file (e.g. HEIC on desktop
 * Chrome) or the re-encode ends up larger, the original file is returned so
 * the upload still succeeds.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<Blob> {
  try {
    // Both createImageBitmap and canvas.toBlob have documented cases (large
    // photos, memory pressure) where they never settle / never call back on
    // mobile browsers. Fence each so a stall becomes a fallback, not a hang.
    const bitmap = await withTimeout(
      createImageBitmap(file, { imageOrientation: 'from-image' }),
      COMPRESS_TIMEOUT_MS,
      'createImageBitmap'
    )
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await withTimeout(
      new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality)),
      COMPRESS_TIMEOUT_MS,
      'canvas.toBlob'
    )
    // Fall back to the original if encoding failed or didn't actually help.
    if (!blob || blob.size >= file.size) return file
    return blob
  } catch (err) {
    dbg('compress:fallback', { name: file.name, size: file.size, type: file.type, err: String(err) })
    return file
  }
}

export interface FeedImageUpload {
  /** Resolves to the public download URL once the upload completes. */
  promise: Promise<string>
  /** Aborts the in-flight upload (e.g. the user removed the thumbnail). */
  cancel: () => void
}

/**
 * Compress, then upload a single image to Firebase Storage under
 * `feed-images/`. Reports progress 0–100 as bytes transfer. Images are keyed
 * by a random id rather than a post id so uploads can start the moment a file
 * is picked, before the post exists.
 */
export function uploadFeedImage(
  file: File,
  onProgress?: (percent: number) => void
): FeedImageUpload {
  let cancelled = false
  let cancelUpload: (() => void) | null = null

  const promise = (async () => {
    if (file.size > MAX_SOURCE_BYTES) {
      throw new Error('That image is too large (max 25 MB).')
    }

    dbg('compress:start', { name: file.name, size: file.size, type: file.type })
    const blob = await compressImage(file)
    if (cancelled) throw new Error('Upload cancelled')

    // compressImage usually returns a canvas JPEG, but falls back to the
    // original file when it can't decode/re-encode (e.g. HEIC on desktop).
    // Label the upload honestly instead of forcing image/jpeg + .jpg.
    const contentType = blob.type || 'image/jpeg'
    let ext = (contentType.split('/')[1] || 'jpg').split('+')[0].toLowerCase()
    if (ext === 'jpeg') ext = 'jpg'

    const path = `feed-images/${generateId()}.${ext}`
    dbg('upload:start', { path, contentType, size: blob.size, bucket: storage.app.options.storageBucket })
    const task = uploadBytesResumable(ref(storage, path), blob, {
      contentType,
    })
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
              const url = await withTimeout(getDownloadURL(task.snapshot.ref), COMPRESS_TIMEOUT_MS, 'getDownloadURL')
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
