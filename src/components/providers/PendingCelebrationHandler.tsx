'use client'

import { useUser } from '@/contexts/UserContext'
import { clearPendingCelebration } from '@/lib/firestore'
import { CHALLENGES } from '@/lib/challenges'
import { CelebrationModal } from '@/components/ui/CelebrationModal'

export function PendingCelebrationHandler() {
  const { currentUser } = useUser()

  if (!currentUser?.pendingCelebration) return null

  const challenge = CHALLENGES.find(c => c.id === currentUser.pendingCelebration!.challengeId)
  if (!challenge) return null

  return (
    <CelebrationModal
      challenge={challenge}
      badgeType={currentUser.pendingCelebration.badgeType ?? 'completed'}
      tier={currentUser.pendingCelebration.tier}
      onClose={async () => {
        await clearPendingCelebration(currentUser.id)
      }}
    />
  )
}
