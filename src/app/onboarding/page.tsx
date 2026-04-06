'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { isOnboardingComplete } from '@/lib/storage'
import type { OnboardingStep, NotificationPreferences, AchievementBadge } from '@/types'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'

import { WelcomeStep }        from '@/components/onboarding/WelcomeStep'
import { DisclaimerStep }     from '@/components/onboarding/DisclaimerStep'
import { ProfileStep }        from '@/components/onboarding/ProfileStep'
import { PastChallengesStep } from '@/components/onboarding/PastChallengesStep'
import { NotificationsStep }  from '@/components/onboarding/NotificationsStep'
import { PWAInstallStep }     from '@/components/onboarding/PWAInstallStep'
import { DoneStep }           from '@/components/onboarding/DoneStep'
import { StepDots }           from '@/components/onboarding/StepDots'

// Steps in order — pwa-install may be skipped at runtime
const STEPS: OnboardingStep[] = [
  'welcome',
  'pwa-install',
  'disclaimer',
  'profile',
  'past-challenges',
  'notifications',
  'done',
]

function OnboardingInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { currentUser, loading } = useUser()

  // Collected data across steps
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS)
  const [earnedBadges, setEarnedBadges] = useState<AchievementBadge[]>([])

  // Determine initial step
  const joinParam = searchParams.get('join')
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    joinParam === 'true' ? 'profile' : 'welcome'
  )

  // Redirect if already onboarded
  useEffect(() => {
    if (!loading && isOnboardingComplete() && currentUser) {
      router.replace('/')
    }
  }, [loading, currentUser, router])

  const nextStep = useCallback((from: OnboardingStep) => {
    const idx = STEPS.indexOf(from)
    if (idx === -1 || idx >= STEPS.length - 1) return
    setCurrentStep(STEPS[idx + 1])
  }, [])

  // Visible step index for progress dots (exclude 'done' from dot count)
  const dotSteps = STEPS.filter(s => s !== 'done') as OnboardingStep[]

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-dvh">
      {/* Progress dots — hidden on done step */}
      {currentStep !== 'done' && (
        <div className="pt-safe pt-4 px-6">
          <StepDots steps={dotSteps} currentStep={currentStep} />
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex flex-col">
        {currentStep === 'welcome' && (
          <WelcomeStep onNext={() => nextStep('welcome')} />
        )}
        {currentStep === 'disclaimer' && (
          <DisclaimerStep onNext={() => nextStep('disclaimer')} />
        )}
        {currentStep === 'profile' && (
          <ProfileStep onNext={() => nextStep('profile')} />
        )}
        {currentStep === 'past-challenges' && (
          <PastChallengesStep
            existingBadges={currentUser?.badges}
            onNext={(badges) => {
              setEarnedBadges(badges)
              nextStep('past-challenges')
            }}
          />
        )}
        {currentStep === 'notifications' && (
          <NotificationsStep
            existingPrefs={currentUser?.notificationPreferences}
            onNext={(prefs) => {
              setNotifPrefs(prefs)
              nextStep('notifications')
            }}
          />
        )}
        {currentStep === 'pwa-install' && (
          <PWAInstallStep
            onNext={() => nextStep('pwa-install')}
            onSkip={() => nextStep('pwa-install')}
          />
        )}
        {currentStep === 'done' && (
          <DoneStep
            earnedBadges={earnedBadges}
            notifPrefs={notifPrefs}
          />
        )}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-dvh">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OnboardingInner />
    </Suspense>
  )
}
