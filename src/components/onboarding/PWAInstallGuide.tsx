'use client'

import { Button } from '@/components/ui/Button'

interface Props {
  platform: 'ios' | 'android'
  // Android only: if provided, shows an "Install App" button instead of manual steps
  onInstall?: () => void
  installing?: boolean
}

const IOS_STEPS = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    label: 'Tap the Share button',
    desc: 'The box with an arrow at the bottom of Safari',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    label: 'Tap "Add to Home Screen"',
    desc: 'Scroll down in the share sheet to find it',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ),
    label: 'Tap "Add"',
    desc: 'Confirm in the top-right corner',
  },
]

const ANDROID_STEPS = [
  {
    icon: <span className="text-lg leading-none">⋮</span>,
    label: 'Tap the menu (⋮)',
    desc: 'Top right of Chrome',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    label: 'Tap "Add to Home Screen"',
    desc: 'Then confirm to install',
  },
]

export function PWAInstallGuide({ platform, onInstall, installing }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
        <p className="text-amber-400 text-sm font-semibold">
          Install required for push notifications
        </p>
        <p className="text-amber-500/80 text-xs">
          Without it you won&apos;t get daily workout reminders or shoutouts when your crew calls you out — the whole accountability side of this challenge runs through push.
        </p>
        {platform === 'ios' && (
          <>
            <p className="text-amber-500/70 text-xs">
              Make sure you&apos;re using Safari — Chrome on iOS doesn&apos;t support push notifications.
            </p>
            <p className="text-amber-500/60 text-xs">Requires iOS 16.4+</p>
          </>
        )}
      </div>

      {platform === 'android' && onInstall ? (
        <Button onClick={onInstall} loading={installing} size="lg" fullWidth>
          Install App
        </Button>
      ) : (
        <div className="space-y-4">
          {(platform === 'ios' ? IOS_STEPS : ANDROID_STEPS).map(({ icon, label, desc }, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center shrink-0">
                {icon}
              </div>
              <div>
                <p className="font-medium text-white text-sm">{label}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
          {platform === 'ios' && (
            <p className="text-xs text-zinc-500 pt-1">
              After adding, close Safari and open the app from your Home Screen.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
