'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { uploadFeedVideo, MAX_FEED_VIDEOS, type FeedVideoUpload } from '@/lib/videos'
import { generateId } from '@/lib/utils'

/** True for a rejection caused by the user removing the video mid-upload. */
function isCancellation(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return e?.code === 'storage/canceled' || /cancel/i.test(e?.message ?? '')
}

export type FeedVideoStatus = 'uploading' | 'done' | 'error'

export interface FeedVideoItem {
  id: string
  /** Object URL (local pick) or remote download URL (already-uploaded). */
  previewUrl: string
  status: FeedVideoStatus
  progress: number // 0–100
  /** Final download URL once uploaded. */
  url?: string
  /** True for videos that were already on the post (edit flow). */
  existing: boolean
}

function makeExisting(url: string): FeedVideoItem {
  return { id: generateId(), previewUrl: url, status: 'done', progress: 100, url, existing: true }
}

/**
 * Manages the lifecycle of videos being attached to a feed post: selection,
 * background upload with progress, removal, and the final ordered list of
 * download URLs. The video-flavoured twin of useFeedImages — no compression
 * step, since browsers can't reliably transcode video.
 *
 * Uploads start immediately on selection so they're usually finished by the
 * time the user hits Post.
 */
export function useFeedVideos(initialUrls: string[] = []) {
  const [items, setItems] = useState<FeedVideoItem[]>(() => initialUrls.map(makeExisting))
  // Track in-flight uploads and object URLs so we can cancel / revoke on removal.
  const uploads = useRef(new Map<string, FeedVideoUpload>())
  const objectUrls = useRef(new Set<string>())
  // Keep the source File per item so a failed upload can be retried.
  const files = useRef(new Map<string, File>())
  // Mirror of `items` so addFiles (an event handler) can read the current
  // count without a stale closure — and without doing side effects in a
  // state updater, which StrictMode double-invokes in dev.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const patch = useCallback((id: string, updates: Partial<FeedVideoItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...updates } : it)))
  }, [])

  const startUpload = useCallback(
    (id: string, file: File) => {
      const upload = uploadFeedVideo(file, pct => patch(id, { progress: pct }))
      uploads.current.set(id, upload)
      upload.promise
        .then(url => patch(id, { status: 'done', progress: 100, url }))
        .catch(err => {
          if (isCancellation(err)) return // item was removed on purpose
          patch(id, { status: 'error' })
          toast.error("Couldn't upload a video — tap it to retry.")
        })
        .finally(() => uploads.current.delete(id))
    },
    [patch]
  )

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const picked = Array.from(fileList).filter(f => f.type.startsWith('video/'))
      if (!picked.length) return

      // Side effects (upload, createObjectURL) run here exactly once — never
      // inside the setState updater, which StrictMode double-invokes in dev.
      const room = MAX_FEED_VIDEOS - itemsRef.current.length
      if (room <= 0) return
      const accepted = picked.slice(0, room)

      const newItems: FeedVideoItem[] = accepted.map(file => {
        const id = generateId()
        const previewUrl = URL.createObjectURL(file)
        objectUrls.current.add(previewUrl)
        files.current.set(id, file)

        startUpload(id, file)

        return { id, previewUrl, status: 'uploading' as const, progress: 0, existing: false }
      })

      // Keep the mirror fresh so a rapid second call sees the new count.
      itemsRef.current = [...itemsRef.current, ...newItems]
      setItems(prev => [...prev, ...newItems])
    },
    [startUpload]
  )

  const retry = useCallback(
    (id: string) => {
      const file = files.current.get(id)
      if (!file) return
      patch(id, { status: 'uploading', progress: 0 })
      startUpload(id, file)
    },
    [patch, startUpload]
  )

  const remove = useCallback((id: string) => {
    uploads.current.get(id)?.cancel()
    uploads.current.delete(id)
    files.current.delete(id)
    setItems(prev => {
      const target = prev.find(it => it.id === id)
      if (target && objectUrls.current.has(target.previewUrl)) {
        URL.revokeObjectURL(target.previewUrl)
        objectUrls.current.delete(target.previewUrl)
      }
      return prev.filter(it => it.id !== id)
    })
  }, [])

  const reset = useCallback((urls: string[] = []) => {
    uploads.current.forEach(u => u.cancel())
    uploads.current.clear()
    files.current.clear()
    objectUrls.current.forEach(url => URL.revokeObjectURL(url))
    objectUrls.current.clear()
    setItems(urls.map(makeExisting))
  }, [])

  // Revoke any outstanding object URLs when the hook unmounts.
  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const doneUrls = items.filter(it => it.status === 'done' && it.url).map(it => it.url as string)
  const isUploading = items.some(it => it.status === 'uploading')
  const hasError = items.some(it => it.status === 'error')
  const canAddMore = items.length < MAX_FEED_VIDEOS

  return { items, addFiles, remove, retry, reset, doneUrls, isUploading, hasError, canAddMore, count: items.length }
}
