import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'
import { generateId } from './utils'

/** Max images allowed on a single feed post. */
export const MAX_FEED_IMAGES = 8

/** Reject anything a phone camera wouldn't reasonably produce. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024 // 25 MB before compression

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
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
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

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    )
    // Fall back to the original if encoding failed or didn't actually help.
    if (!blob || blob.size >= file.size) return file
    return blob
  } catch {
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
      throw new Error('Image is too large (max 25 MB).')
    }

    const blob = await compressImage(file)
    if (cancelled) throw new Error('Upload cancelled')

    // compressImage usually returns a canvas JPEG, but falls back to the
    // original file when it can't decode/re-encode (e.g. HEIC on desktop).
    // Label the upload honestly instead of forcing image/jpeg + .jpg.
    const contentType = blob.type || 'image/jpeg'
    let ext = (contentType.split('/')[1] || 'jpg').split('+')[0].toLowerCase()
    if (ext === 'jpeg') ext = 'jpg'

    const path = `feed-images/${generateId()}.${ext}`
    const task = uploadBytesResumable(ref(storage, path), blob, {
      contentType,
    })
    cancelUpload = () => task.cancel()

    return await new Promise<string>((resolve, reject) => {
      task.on(
        'state_changed',
        snap => {
          if (snap.totalBytes > 0) {
            onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100))
          }
        },
        reject,
        async () => {
          try {
            resolve(await getDownloadURL(task.snapshot.ref))
          } catch (err) {
            reject(err)
          }
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
