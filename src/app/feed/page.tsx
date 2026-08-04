'use client'

import { Fragment, useState, useEffect, useRef, useCallback } from 'react'
import { FeedPost } from '@/components/feed/FeedPost'
import { NewPostModal } from '@/components/feed/NewPostModal'
import { subscribeToFeed } from '@/lib/firestore'
import { useUser } from '@/contexts/UserContext'
import { useRegion } from '@/contexts/RegionContext'
import { pacificDayKey, formatDaySeparator } from '@/lib/utils'
import type { FeedPost as FeedPostType } from '@/types'

const PAGE_SIZE = 30

export default function FeedPage() {
  const { currentUser, loading } = useUser()
  const { regionId, ready: regionReady, socialReadOnly } = useRegion()
  const [posts, setPosts]             = useState<FeedPostType[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [newPostOpen, setNewPostOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [hasMore, setHasMore]         = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Growing-window live listener: the newest `visibleCount` posts stay
  // real-time; scrolling to the bottom widens the window by one page.
  useEffect(() => {
    if (!regionReady) return
    const unsub = subscribeToFeed(regionId, ({ posts: incoming, hasMore: more }) => {
      setPosts(incoming)
      setHasMore(more)
      setFeedLoading(false)
      setLoadingMore(false)
    }, visibleCount)
    return unsub
  }, [visibleCount, regionId, regionReady])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setVisibleCount(c => c + PAGE_SIZE)
  }, [loadingMore, hasMore])

  // Auto-load the next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '400px' }, // start fetching before it's fully in view
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/60 px-4 py-3 safe-area-inset-top">
        <h1 className="text-lg font-bold text-white">Feed</h1>
      </header>

      {/* Content */}
      <div className="flex-1">
        {feedLoading ? (
          <div className="flex flex-col gap-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-4 border-b border-zinc-800/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-32" />
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-full" />
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <span className="text-5xl mb-4">💪</span>
            <p className="text-zinc-300 font-semibold text-lg mb-1">Be the first to post today</p>
            <p className="text-zinc-500 text-sm">Share what&apos;s on your mind or shout out a crew member.</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-zinc-800/60">
              {(() => {
                let lastDay: string | null = null
                return posts.map(post => {
                  const dayKey = pacificDayKey(post.createdAt)
                  const showSeparator = dayKey !== lastDay
                  lastDay = dayKey
                  return (
                    <Fragment key={post.id}>
                      {showSeparator && (
                        <li
                          className="sticky top-[calc(env(safe-area-inset-top)+3.25rem)] z-[5] bg-[#09090b]/95 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                        >
                          {formatDaySeparator(dayKey)}
                        </li>
                      )}
                      <li>
                        <FeedPost post={post} />
                      </li>
                    </Fragment>
                  )
                })
              })()}
            </ul>

            {/* Infinite-scroll sentinel + loading state */}
            <div ref={sentinelRef} className="h-px" />
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-orange-500 rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && !loadingMore && (
              <p className="text-center text-zinc-600 text-xs py-6">You&apos;re all caught up 💪</p>
            )}
          </>
        )}
      </div>

      {/* New Post FAB — floating above bottom nav */}
      {currentUser && !loading && !socialReadOnly && (
        <button
          onClick={() => setNewPostOpen(true)}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-20 w-14 h-14 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center transition-colors"
          aria-label="New post"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      <NewPostModal open={newPostOpen} onClose={() => setNewPostOpen(false)} />
    </div>
  )
}
