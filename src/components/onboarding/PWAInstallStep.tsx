'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface Props {
  onNext: () => void
  onSkip?: () => void
}

type Platform = 'ios' | 'android' | 'installed' | 'other'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'other'
  if (window.matchMedia('(display-mode: standalone)').matches) return 'installed'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

export function PWAInstallStep({ onNext, onSkip }: Props) {
  const [platform, setPlatform] = useState<Platform>('other')
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => Promise<void> } | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as Event & { prompt: () => Promise<void> })
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Auto-skip if already installed
  useEffect(() => {
    if (platform === 'installed') onNext()
  }, [platform, onNext])

  async function handleInstallAndroid() {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    setInstalling(false)
    onNext()
  }

  if (platform === 'installed') return null

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      <div className="mb-8">
        <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-3xl">📱</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Add to Home Screen</h2>
        <p className="text-zinc-400 text-sm">
          Install the app for push notifications and a native experience.
        </p>
      </div>

      {platform === 'ios' && (
        <div className="flex-1 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-2 space-y-2">
            <p className="text-amber-400 text-sm font-semibold">
              Adding to Home Screen is required to receive push notifications and encouragement from your crew.
            </p>
            <p className="text-amber-500/80 text-xs">
              Make sure you&apos;re using Safari — Chrome on iOS doesn&apos;t support push notifications.
            </p>
            <p className="text-amber-500/60 text-xs">Requires iOS 16.4+</p>
          </div>

          {[
            {
              step: 1,
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              ),
              label: 'Tap the Share button',
              desc: 'The box with an arrow at the bottom of Safari',
            },
            {
              step: 2,
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              ),
              label: 'Tap "Add to Home Screen"',
              desc: 'Scroll down in the share sheet to find it',
            },
            {
              step: 3,
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ),
              label: 'Tap "Add"',
              desc: 'Confirm in the top-right corner',
            },
          ].map(({ step, icon, label, desc }) => (
            <div key={step} className="flex items-start gap-4">
              <div className="w-10 h-10 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center shrink-0">
                {icon}
              </div>
              <div>
                <p className="font-medium text-white text-sm">{label}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {platform === 'android' && (
        <div className="flex-1">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
            <p className="text-amber-400 text-sm font-semibold">
              Adding to Home Screen is required to receive push notifications and encouragement from your crew.
            </p>
          </div>
          {deferredPrompt ? (
            <Button onClick={handleInstallAndroid} loading={installing} size="lg" fullWidth className="mb-4">
              Install App
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center shrink-0 text-lg">
                  ⋮
                </div>
                <div>
                  <p className="font-medium text-white text-sm">Tap the menu (⋮)</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Top right of Chrome</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white text-sm">Tap "Add to Home Screen"</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Then confirm to install</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {platform === 'other' && (
        <div className="flex-1">
          <p className="text-zinc-400 text-sm">
            On desktop you can install this app from your browser's address bar or menu.
            On mobile, use Safari (iOS) or Chrome (Android) for the best experience.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {platform !== 'android' && (
          <Button onClick={onNext} size="lg" fullWidth>
            I've installed it →
          </Button>
        )}
        <button
          onClick={onSkip ?? onNext}
          className="w-full text-sm text-zinc-500 hover:text-zinc-300 py-2 transition-colors"
        >
          I'll do this later
        </button>
      </div>
    </div>
  )
}
