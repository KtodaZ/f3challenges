'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/contexts/UserContext'
import { ReinstallPrompt } from './ReinstallPrompt'
import {
  CANONICAL_HOST, canonicalOrigin, claimUrl, isLegacyOrigin, isMigrationSnoozed,
  snoozeMigration, detectMigrationPlatform,
  retireLegacyPushRegistration, type MigrationPlatform,
} from '@/lib/migration'

/**
 * Shown only on the old origin. Hands the PAX over to the new domain and then
 * retires this origin's push registration so they don't get double
 * notifications. See src/lib/migration.ts for the whole flow.
 *
 * Renders `children` untouched everywhere else — localhost, previews, and the
 * new domain never see this.
 */
export function MigrationGate({ children }: { children: React.ReactNode }) {
  const { currentUser } = useUser()
  // One object so the whole check lands in a single render. Starts "snoozed"
  // so the takeover never flashes on the new domain or during SSR hydration.
  const [env, setEnv] = useState<{
    legacy: boolean; snoozed: boolean; platform: MigrationPlatform
  }>({ legacy: false, snoozed: true, platform: 'other' })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({
      legacy: isLegacyOrigin(),
      snoozed: isMigrationSnoozed(),
      platform: detectMigrationPlatform(),
    })
  }, [])

  const { legacy, snoozed, platform } = env

  // Once they've claimed on the new origin, this install should stop competing
  // for their push notifications. Runs once, only here on the old origin.
  const migratedAt = currentUser?.migratedAt
  const userId = currentUser?.id
  useEffect(() => {
    if (!legacy || !migratedAt || !userId) return
    retireLegacyPushRegistration(userId)
  }, [legacy, migratedAt, userId])

  if (!legacy) return <><ReinstallPrompt />{children}</>
  if (snoozed) return <>{children}</>

  const alreadyMoved = !!migratedAt
  const href = currentUser ? claimUrl(currentUser.id) : canonicalOrigin()

  return (
    <div className="min-h-dvh flex flex-col px-6 py-10 max-w-lg mx-auto">
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="space-y-3">
          <div className="text-5xl">📦</div>
          <h1 className="text-3xl font-black text-white leading-tight">
            {alreadyMoved ? 'You’ve already moved' : 'We’ve moved'}
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            {alreadyMoved ? (
              <>
                This is the old version. Everything now lives at{' '}
                <span className="text-orange-400 font-medium">{CANONICAL_HOST}</span> — open
                that one from your home screen, and you can delete this icon.
              </>
            ) : (
              <>
                The app has a real home now:{' '}
                <span className="text-orange-400 font-medium">{CANONICAL_HOST}</span>. Tap below
                and you&rsquo;ll land signed in — no need to pick your name again.
              </>
            )}
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => { window.location.href = href }}
        >
          {alreadyMoved ? `Open ${CANONICAL_HOST} →` : 'Take me to the new app →'}
        </Button>

        {/* Deliberately NOT gated on isStandalone(): this link usually gets
            opened from Slack, i.e. a browser tab, which reports "not
            installed" even when the PAX does have the old icon. The actual
            step-by-step lives on the new origin (ReinstallPrompt), where
            standalone detection answers the question that matters. */}
        {!alreadyMoved && platform !== 'other' && (
          <p className="text-zinc-500 text-xs leading-relaxed border-t border-zinc-800 pt-6">
            If you added this to your home screen, that icon stays pinned to the old
            address — you&rsquo;ll re-add it once you land, and we&rsquo;ll walk you
            through it there. Your streak, badges and history all come with you.
          </p>
        )}

        {!alreadyMoved && (
          <button
            onClick={() => { snoozeMigration(); setEnv(e => ({ ...e, snoozed: true })) }}
            className="text-zinc-600 text-xs underline underline-offset-4 self-center"
          >
            Not right now
          </button>
        )}
      </div>
    </div>
  )
}
