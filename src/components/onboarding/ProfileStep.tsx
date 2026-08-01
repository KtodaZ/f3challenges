'use client'

import { useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useRegion } from '@/contexts/RegionContext'
import { upsertUser } from '@/lib/firestore'
import { generateId } from '@/lib/utils'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'
import type { User } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface ProfileStepProps {
  onNext: () => void
}

export function ProfileStep({ onNext }: ProfileStepProps) {
  // The roster (active crew, archived PAX excluded) is already scoped to the
  // chosen region by UserContext, so both the picker and the duplicate-name
  // check below are region-local. Roster rather than the full directory: an
  // archived PAX must not be claimable from the name picker.
  const { roster, login } = useUser()
  const { regionId, region } = useRegion()
  // A brand-new region has nobody to pick from, so "New PAX" is the only
  // sensible landing mode — but an explicit tap always wins over the default.
  const [modeOverride, setModeOverride] = useState<'existing' | 'new' | null>(null)
  const mode = modeOverride ?? (roster.length === 0 ? 'new' : 'existing')
  const setMode = setModeOverride
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSelectExisting() {
    if (!selectedUser) return
    login(selectedUser)
    onNext()
  }

  async function handleCreateNew() {
    const trimmed = newName.trim()
    if (!trimmed) {
      setNameError('Enter your F3 name to continue')
      return
    }
    if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters')
      return
    }

    // Duplicate check is region-scoped on purpose: F3 names repeat across
    // regions constantly, and Sactown's Splice is not Bedrock's Splice.
    const duplicate = roster.find(
      u => u.displayName.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) {
      setNameError(`That name is already taken in ${region.shortName} — are you them? Select from the list.`)
      return
    }

    setLoading(true)
    try {
      const newUser: User = {
        id: generateId(),
        displayName: trimmed,
        regionId,
        createdAt: new Date().toISOString(),
        notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
        badges: [],
        currentStreak: 0,
        longestStreak: 0,
      }
      await upsertUser(newUser)
      login(newUser)
      onNext()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Who are you?</h1>
        <p className="text-zinc-400 text-sm">
          {mode === 'existing'
            ? `Select your name from the ${region.shortName} crew.`
            : `Enter your F3 name to join ${region.name}.`}
        </p>
      </div>

      {mode === 'existing' ? (
        <>
          {roster.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-zinc-500 text-sm">No crew members yet.</p>
              <button
                onClick={() => setMode('new')}
                className="text-orange-400 text-sm font-medium underline underline-offset-4"
              >
                Be the first to join →
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto no-scrollbar -mx-6 px-6">
                <div className="grid grid-cols-2 gap-3 pb-4">
                  <button
                    onClick={() => { setMode('new'); setSelectedUser(null) }}
                    className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed border-orange-500/50 bg-orange-500/5 hover:border-orange-500 hover:bg-orange-500/10 active:bg-orange-500/15 transition-all text-center min-h-[120px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-orange-500/10 border-2 border-orange-500/50 flex items-center justify-center">
                      <span className="text-2xl text-orange-400 leading-none">+</span>
                    </div>
                    <span className="text-sm font-semibold text-orange-400 leading-tight">
                      New PAX
                    </span>
                  </button>
                  {roster.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={cn(
                        'flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all text-center',
                        selectedUser?.id === user.id
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 active:border-zinc-600'
                      )}
                    >
                      <Avatar name={user.displayName} size="lg" />
                      <span className={cn(
                        'text-sm font-semibold leading-tight',
                        selectedUser?.id === user.id ? 'text-orange-400' : 'text-white'
                      )}>
                        {user.displayName}
                      </span>
                      {selectedUser?.id === user.id && (
                        <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                          <svg viewBox="0 0 8 7" fill="none" className="w-2.5 h-2.5">
                            <path d="M1 3.5L3 5.5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!selectedUser}
                  onClick={handleSelectExisting}
                >
                  That&apos;s me →
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 space-y-6">
            {/* Illustration */}
            <div className="flex justify-center py-4">
              <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                <span className="text-3xl">🤙</span>
              </div>
            </div>

            <Input
              label="What's your F3 name?"
              placeholder="e.g. Gelato, Milk Man, Turbo..."
              value={newName}
              onChange={e => {
                setNewName(e.target.value)
                if (nameError) setNameError('')
              }}
              error={nameError}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreateNew() }}
            />

            <p className="text-xs text-zinc-500 leading-relaxed">
              This is your F3 alias — the name your crew will know you by. It can&apos;t be changed later (for now).
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onClick={handleCreateNew}
            >
              Join the crew →
            </Button>
            <button
              onClick={() => { setMode('existing'); setNameError(''); setNewName('') }}
              className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-2"
            >
              ← Back to crew list
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
