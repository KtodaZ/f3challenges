'use client'

import { useState, useEffect } from 'react'
import { FeedPost } from '@/components/feed/FeedPost'
import { NewPostModal } from '@/components/feed/NewPostModal'
import { subscribeToFeed } from '@/lib/firestore'
import { useUser } from '@/contexts/UserContext'
import type { FeedPost as FeedPostType } from '@/types'

export default function FeedPage() {
  const { currentUser, loading } = useUser()
  const [posts, setPosts]             = useState<FeedPostType[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [newPostOpen, setNewPostOpen] = useState(false)

  useEffect(() => {
    const unsub = subscribeToFeed(incoming => {
      setPosts(incoming)
      setFeedLoading(false)
    })
    return unsub
  }, [])

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
            <p className="text-zinc-500 text-sm">Share what's on your mind or shout out a crew member.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {posts.map(post => (
              <li key={post.id}>
                <FeedPost post={post} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New Post FAB — floating above bottom nav */}
      {currentUser && !loading && (
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
