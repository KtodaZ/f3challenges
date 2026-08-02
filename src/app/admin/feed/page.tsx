'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdmin } from '@/contexts/AdminContext'
import { adminFetch } from '@/lib/admin-client'
import type { AdminPostRow } from '@/app/api/admin/feed/route'
import { REGIONS, resolveRegion } from '@/lib/challenges'
import { Button } from '@/components/ui/Button'

function when(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m ago`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AdminFeedPage() {
  const { state, reportFailure } = useAdmin()
  const [posts, setPosts] = useState<AdminPostRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>('all')

  const fail = useCallback((e: unknown) => {
    reportFailure(e)
    setError(e instanceof Error ? e.message : 'Failed')
  }, [reportFailure])

  const load = useCallback(() => {
    const qs = regionFilter === 'all' ? '' : `?regionId=${regionFilter}`
    adminFetch<{ posts: AdminPostRow[] }>(`/api/admin/feed${qs}`)
      .then(r => setPosts(r.posts))
      .catch(fail)
  }, [regionFilter, fail])

  useEffect(() => { if (state.status === 'ready') load() }, [state.status, load])

  async function remove(post: AdminPostRow, comment?: { id: string; authorName: string }) {
    const what = comment
      ? `Remove ${comment.authorName}'s comment?`
      : `Remove ${post.authorName}'s post?`
    if (!confirm(`${what}\n\nIt disappears from the feed for everyone. Nothing is notified, and it's recorded in the audit log.`)) return

    const key = comment ? `${post.id}/${comment.id}` : post.id
    setBusy(key)
    setError(null)
    try {
      const qs = comment ? `?commentId=${comment.id}` : ''
      await adminFetch(`/api/admin/feed/${post.id}${qs}`, { method: 'DELETE' })
      load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  if (state.status !== 'ready') return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Feed</h1>
        <p className="text-sm text-zinc-500">
          The 50 most recent posts. Removing hides something from everyone&apos;s feed — the
          author isn&apos;t told, and nothing is permanently erased.
        </p>
      </div>

      <select
        value={regionFilter}
        onChange={e => setRegionFilter(e.target.value)}
        className="bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white px-3 py-1.5"
      >
        <option value="all">All regions</option>
        {REGIONS.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
      </select>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {posts === null ? (
        <p className="text-sm text-zinc-600">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-zinc-600">Nothing in this feed yet.</p>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div key={post.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500 mb-1">
                    <span className="text-zinc-300 font-medium">{post.authorName}</span>
                    {' · '}{resolveRegion(post.regionId).shortName}{' · '}{when(post.createdAt)}
                    {post.type === 'system' && ' · system'}
                    {post.imageCount > 0 && ` · ${post.imageCount} attachment${post.imageCount === 1 ? '' : 's'}`}
                  </p>
                  <p className="text-sm text-white whitespace-pre-wrap break-words">
                    {post.content || <span className="text-zinc-600 italic">(no text)</span>}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => remove(post)}
                  loading={busy === post.id}
                  className="shrink-0"
                >
                  Remove
                </Button>
              </div>

              {post.comments.length > 0 && (
                <div className="border-t border-zinc-800 bg-zinc-950/40 divide-y divide-zinc-800/60">
                  {post.comments.map(c => (
                    <div key={c.id} className="flex items-start gap-3 px-4 py-2 pl-8">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-600">
                          <span className="text-zinc-400">{c.authorName}</span>
                          {' · '}{when(c.createdAt)}
                        </p>
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{c.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(post, { id: c.id, authorName: c.authorName })}
                        loading={busy === `${post.id}/${c.id}`}
                        className="shrink-0"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
