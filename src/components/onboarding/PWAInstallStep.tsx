'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PWAInstallGuide } from './PWAInstallGuide'

interface Props {
  onNext: () => void
  onSkip: () => void
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
  const [skipModalOpen, setSkipModalOpen] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform())
  }, [])

  // Auto-skip if already installed or on Android (notifications work without PWA install)
  useEffect(() => {
    if (platform === 'installed' || platform === 'android') onNext()
  }, [platform, onNext])

  if (platform === 'installed' || platform === 'android') return null

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      <div className="mb-8">
        <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-3xl">📱</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Add to Home Screen</h2>
        <p className="text-zinc-400 text-sm">
          Required on iOS to receive push notifications and a native experience.
        </p>
      </div>

      {platform === 'ios' && (
        <div className="flex-1">
          <PWAInstallGuide platform="ios" />
        </div>
      )}

      {platform === 'other' && (
        <div className="flex-1">
          <p className="text-zinc-400 text-sm">
            On desktop you can install this app from your browser&apos;s address bar or menu.
            On mobile, use Safari (iOS) or Chrome (Android) for the best experience.
          </p>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={onNext} size="lg" fullWidth>
          I&apos;ve installed it →
        </Button>
        <button
          onClick={() => setSkipModalOpen(true)}
          className="w-full text-sm text-zinc-600 hover:text-zinc-400 py-2 mt-2 transition-colors"
        >
          Skip for now
        </button>
      </div>

      <Modal open={skipModalOpen} onClose={() => setSkipModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">You&apos;ll miss out on notifications</h3>
            <p className="text-sm text-zinc-400">
              Without installing, you won&apos;t receive daily workout reminders or shoutouts when your crew calls you out. The whole accountability side of this challenge runs through push notifications.
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            You can always enable this later from <span className="text-zinc-400">Settings → Notifications</span>.
          </p>
          <div className="space-y-2">
            <Button onClick={onSkip} variant="secondary" size="lg" fullWidth>
              I don&apos;t want push notifications for tags or reminders
            </Button>
            <Button onClick={() => setSkipModalOpen(false)} size="lg" fullWidth>
              Let me install it
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
