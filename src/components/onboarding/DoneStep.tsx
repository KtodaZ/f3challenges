'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { getDailyTarget, getTodayPT, getChallengeWeek } from '@/lib/challenges'
import { useCurrentChallenge } from '@/hooks/useChallenge'
import { setOnboardingComplete } from '@/lib/storage'
import { updateUser } from '@/lib/firestore'
import { useUser } from '@/contexts/UserContext'
import type { AchievementBadge, NotificationPreferences } from '@/types'

interface Props {
  earnedBadges?: AchievementBadge[]
  notifPrefs?: NotificationPreferences
}

export function DoneStep({ earnedBadges, notifPrefs }: Props) {
  const router = useRouter()
  const { currentUser } = useUser()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setChecked(true), 300)
    return () => clearTimeout(t)
  }, [])

  const challenge = useCurrentChallenge()
  const today     = getTodayPT()
  const target    = challenge ? getDailyTarget(challenge, today) : null
  const week      = challenge ? getChallengeWeek(challenge, today) : undefined

  async function handleGo() {
    if (currentUser) {
      const updates: Parameters<typeof updateUser>[1] = {}
      if (earnedBadges !== undefined) updates.badges = earnedBadges
      if (notifPrefs !== undefined) updates.notificationPreferences = notifPrefs
      if (Object.keys(updates).length > 0) {
        await updateUser(currentUser.id, updates)
      }
    }
    setOnboardingComplete()
    router.push('/')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
      {/* Animated checkmark */}
      <div className="relative w-24 h-24 mb-8">
        <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
          <circle
            cx="48" cy="48" r="40"
            fill="none"
            stroke="#22c55e"
            strokeWidth="6"
            strokeDasharray="251.2"
            strokeDashoffset={checked ? 0 : 251.2}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        <svg viewBox="0 0 96 96" className="absolute inset-0 w-24 h-24">
          <path
            d="M30 50 L43 63 L66 36"
            fill="none"
            stroke="#22c55e"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="60"
            strokeDashoffset={checked ? 0 : 60}
            style={{ transition: 'stroke-dashoffset 0.4s ease-out 0.5s' }}
          />
        </svg>
      </div>

      <h2 className="text-3xl font-bold text-white mb-2">
        You&apos;re all set! 💪
      </h2>
      <p className="text-zinc-400 mb-8">You&apos;re all set and ready to conquer.</p>

      {challenge && target && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-sm mb-8 text-left">
          {/* Weekly-cumulative challenges have no daily quota — showing
              "0 total reps" would be worse than useless. The week's target and
              the menu of movements is the honest version. */}
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
            {target.isOpenEnded ? 'This week' : 'Today’s challenge'}
          </p>
          <p className="text-lg font-bold text-orange-400">{challenge.name}</p>
          <p className="text-white mt-1">
            <span className="text-2xl font-bold">
              {target.isOpenEnded ? (week?.target.toLocaleString() ?? '—') : target.totalReps}
            </span>
            <span className="text-zinc-400 text-sm ml-1.5">
              {target.isOpenEnded ? 'reps this week' : 'total reps'}
            </span>
          </p>
          <div className="mt-3 space-y-1">
            {target.exercises.map(({ exercise, reps }) => (
              <div key={exercise.id} className="flex justify-between text-sm">
                <span className="text-zinc-300">{exercise.name}</span>
                <span className="text-white font-medium">
                  {target.isOpenEnded ? 'any amount' : `${reps} reps`}
                </span>
              </div>
            ))}
          </div>
          {target.isOpenEnded && (
            <p className="text-xs text-zinc-500 mt-3">
              Any mix, any day — break it up however you want.
            </p>
          )}
        </div>
      )}

      <Button onClick={handleGo} size="lg" fullWidth className="max-w-sm">
        Go to today&apos;s challenge →
      </Button>
    </div>
  )
}
