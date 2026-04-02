'use client'

import { Avatar } from '@/components/ui/Avatar'
import type { User } from '@/types'

interface MentionAutocompleteProps {
  query: string
  users: User[]
  onSelect: (user: User) => void
}

export function MentionAutocomplete({ query, users, onSelect }: MentionAutocompleteProps) {
  const filtered = users.filter(u =>
    u.displayName.toLowerCase().includes(query.toLowerCase())
  )

  if (filtered.length === 0) return null

  return (
    <div className="absolute z-20 bottom-full mb-1 left-0 right-0 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
      {filtered.map(user => (
        <button
          key={user.id}
          type="button"
          onMouseDown={e => {
            // Prevent textarea blur before we handle the click
            e.preventDefault()
            onSelect(user)
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
        >
          <Avatar name={user.displayName} size="sm" />
          <span className="text-sm font-medium text-white">{user.displayName}</span>
        </button>
      ))}
    </div>
  )
}
