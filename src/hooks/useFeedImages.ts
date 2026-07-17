'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadFeedImage, MAX_FEED_IMAGES, type FeedImageUpload } from '@/lib/images'
import { generateId } from '@/lib/utils'

export type FeedImageStatus = 'uploading' | 'done' | 'error'

export interface FeedImageItem {
  id: string
  /** Object URL (local pick) or remote download URL (already-uploaded). */
  previewUrl: string
  status: FeedImageStatus
  progress: number // 0–100
  /** Final download URL once uploaded. */
  url?: string
  /** True for images that were already on the post (edit flow). */
  existing: boolean
}

function makeExisting(url: string): FeedImageItem {
  return { id: generateId(), previewUrl: url, status: 'done', progress: 100, url, existing: true }
}

/**
 * Manages the lifecycle of images being attached to a feed post: selection,
 * client-side compression, background upload with progress, removal, and the
 * final ordered list of download URLs. Used by both the new-post and
 * edit-post modals.
 *
 * Uploads start immediately on selection so they're usually finished by the
 * time the user hits Post.
 */
export function useFeedImages(initialUrls: string[] = []) {
  const [items, setItems] = useState<FeedImageItem[]>(() => initialUrls.map(makeExisting))
  // Track in-flight uploads and object URLs so we can cancel / revoke on removal.
  const uploads = useRef(new Map<string, FeedImageUpload>())
  const objectUrls = useRef(new Set<string>())
  // Mirror of `items` so addFiles (an event handler) can read the current
  // count without a stale closure — and without doing side effects in a
  // state updater, which StrictMode double-invokes in dev.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const patch = useCallback((id: string, updates: Partial<FeedImageItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...updates } : it)))
  }, [])

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(f => f.type.startsWith('image/'))
      if (!files.length) return

      // Side effects (upload, createObjectURL) run here exactly once — never
      // inside the setState updater, which StrictMode double-invokes in dev.
      const room = MAX_FEED_IMAGES - itemsRef.current.length
      if (room <= 0) return
      const accepted = files.slice(0, room)

      const newItems: FeedImageItem[] = accepted.map(file => {
        const id = generateId()
        const previewUrl = URL.createObjectURL(file)
        objectUrls.current.add(previewUrl)

        const upload = uploadFeedImage(file, pct => patch(id, { progress: pct }))
        uploads.current.set(id, upload)
        upload.promise
          .then(url => patch(id, { status: 'done', progress: 100, url }))
          .catch(() => patch(id, { status: 'error' }))
          .finally(() => uploads.current.delete(id))

        return { id, previewUrl, status: 'uploading' as const, progress: 0, existing: false }
      })

      // Keep the mirror fresh so a rapid second call sees the new count.
      itemsRef.current = [...itemsRef.current, ...newItems]
      setItems(prev => [...prev, ...newItems])
    },
    [patch]
  )

  const remove = useCallback((id: string) => {
    uploads.current.get(id)?.cancel()
    uploads.current.delete(id)
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
  const canAddMore = items.length < MAX_FEED_IMAGES

  return { items, addFiles, remove, reset, doneUrls, isUploading, hasError, canAddMore, count: items.length }
}
