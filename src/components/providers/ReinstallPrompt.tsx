'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { needsReinstall, clearNeedsReinstall } from '@/lib/storage'
import { CANONICAL_HOST, detectMigrationPlatform, isStandalone, type MigrationPlatform } from '@/lib/migration'

/**
 * Shown on the NEW origin to a PAX who just came across on a claim link and
 * isn't running standalone yet.
 *
 * It lives here rather than on the old origin on purpose: the old origin can
 * only tell you whether *that* session was standalone (a Slack link opens a
 * browser tab, so it usually says no), and the install has to happen against
 * this origin anyway. Here, `isStandalone()` answers exactly the question that
 * matters — is this device set up on the new address yet.
 *
 * Sticks around until they're actually installed. Dismissing is permanent, so
 * nobody gets nagged forever.
 */

const IOS_STEPS = [
  { n: '1', label: 'Tap the Share button', desc: 'The box with an arrow, at the bottom of Safari' },
  { n: '2', label: 'Tap “Add to Home Screen”', desc: 'Scroll down in the share sheet to find it' },
  { n: '3', label: 'Delete the old icon', desc: 'Press and hold the old one, then Remove App' },
  { n: '4', label: 'Open the new icon and allow notifications', desc: 'iOS treats this as a new app, so permission resets' },
]

const ANDROID_STEPS = [
  { n: '1', label: 'Tap the menu (⋮)', desc: 'Top right of Chrome' },
  { n: '2', label: 'Tap “Add to Home Screen”', desc: 'Then confirm to install' },
  { n: '3', label: 'Delete the old icon', desc: 'Press and hold the old one, then Uninstall' },
]

export function ReinstallPrompt() {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<MigrationPlatform>('other')

  useEffect(() => {
    if (!needsReinstall()) return
    // Already installed against this origin — nothing to do, and it means the
    // move is complete.
    if (isStandalone()) { clearNeedsReinstall(); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectMigrationPlatform())
    setOpen(true)
  }, [])

  function dismiss() {
    clearNeedsReinstall()
    setOpen(false)
  }

  if (!open) return null

  const steps = platform === 'ios' ? IOS_STEPS : ANDROID_STEPS

  return (
    <Modal open={open} onClose={dismiss} title="You’re in — one last step">
      <div className="space-y-5">
        <p className="text-sm text-zinc-400 leading-relaxed">
          You&rsquo;re signed in on{' '}
          <span className="text-orange-400 font-medium">{CANONICAL_HOST}</span> and everything
          came with you. But your home screen icon still points at the old address, so
          notifications would keep going there.
        </p>

        {platform === 'other' ? (
          <p className="text-sm text-zinc-400 leading-relaxed">
            Open <span className="text-orange-400 font-medium">{CANONICAL_HOST}</span> on your
            phone to finish setting it up, and delete the old icon once you have.
          </p>
        ) : (
          <div className="space-y-4">
            {steps.map(({ n, label, desc }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="w-7 h-7 shrink-0 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">
                  {n}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
            {platform === 'ios' && (
              <p className="text-xs text-zinc-500">
                Use Safari for this — Chrome on iOS can&rsquo;t do push notifications.
              </p>
            )}
          </div>
        )}

        <Button variant="primary" size="lg" fullWidth onClick={dismiss}>
          Got it
        </Button>
      </div>
    </Modal>
  )
}
