'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useRegion } from '@/contexts/RegionContext'
import { isOnboardingComplete } from '@/lib/storage'
import type { OnboardingStep, NotificationPreferences } from '@/types'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'

import { WelcomeStep }       from '@/components/onboarding/WelcomeStep'
import { RegionStep }        from '@/components/onboarding/RegionStep'
import { DisclaimerStep }    from '@/components/onboarding/DisclaimerStep'
import { ProfileStep }       from '@/components/onboarding/ProfileStep'
import { NotificationsStep } from '@/components/onboarding/NotificationsStep'
import { PWAInstallStep }    from '@/components/onboarding/PWAInstallStep'
import { DoneStep }          from '@/components/onboarding/DoneStep'
import { StepDots }          from '@/components/onboarding/StepDots'

// Steps in order — 'region' and 'pwa-install' may be skipped at runtime.
// 'region' comes before 'profile' because the name picker only lists the
// chosen region's crew.
const ALL_STEPS: OnboardingStep[] = [
  'welcome',
  'region',
  'pwa-install',
  'disclaimer',
  'profile',
  'notifications',
  'done',
]

function OnboardingInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { currentUser, loading } = useUser()
  const { regionChosen, ready: regionReady } = useRegion()

  // Collected data across steps
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS)

  // An invite link (?region=sactown) already answered the region question, and
  // so does a device that has been here before — don't ask twice.
  const STEPS = useMemo(
    () => (regionChosen ? ALL_STEPS.filter(s => s !== 'region') : ALL_STEPS),
    [regionChosen]
  )

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
  }, [STEPS])

  // Visible step index for progress dots (exclude 'done' from dot count)
  const dotSteps = STEPS.filter(s => s !== 'done') as OnboardingStep[]

  // Hold the first paint until the region resolves — otherwise the welcome
  // screen and the region step both flash the wrong region's branding.
  if (loading || !regionReady) {
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
        {currentStep === 'region' && (
          <RegionStep onNext={() => nextStep('region')} />
        )}
        {currentStep === 'disclaimer' && (
          <DisclaimerStep onNext={() => nextStep('disclaimer')} />
        )}
        {currentStep === 'profile' && (
          <ProfileStep onNext={() => nextStep('profile')} />
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
          <DoneStep notifPrefs={notifPrefs} />
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
