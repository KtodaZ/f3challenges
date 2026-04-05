'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { useFCM } from '@/hooks/useFCM'

const DBG = process.env.NEXT_PUBLIC_DEBUG_URL
function dbg(label: string, data: unknown) {
  if (!DBG) return
  fetch(DBG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, src: 'troubleshoot', data }) }).catch(() => {})
}

type Platform = 'ios-standalone' | 'ios-browser' | 'android' | 'desktop'
type TestState = 'idle' | 'sending' | 'sent' | 'no_tokens' | 'error'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  if (isIOS && isStandalone) return 'ios-standalone'
  if (isIOS) return 'ios-browser'
  if (isAndroid) return 'android'
  return 'desktop'
}

function StatusRow({ ok, label }: { ok: boolean | null; label: string }) {
  const icon = ok === null ? '⏳' : ok ? '✓' : '✗'
  const color = ok === null ? 'text-zinc-500' : ok ? 'text-green-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`w-5 text-center font-bold ${color}`}>{icon}</span>
      <span className="text-sm text-zinc-300">{label}</span>
    </div>
  )
}

function FixInstructions({ platform, permission }: { platform: Platform; permission: NotificationPermission | 'unsupported' }) {
  if (permission !== 'denied') return null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-white">How to unblock notifications</p>
      {platform === 'ios-standalone' && (
        <ol className="text-sm text-zinc-400 space-y-2 list-none">
          <li><span className="text-orange-400 font-medium">1.</span> Open the iPhone <span className="text-white">Settings</span> app</li>
          <li><span className="text-orange-400 font-medium">2.</span> Scroll down and tap <span className="text-white">F3 Bedrock</span> (the app name)</li>
          <li><span className="text-orange-400 font-medium">3.</span> Tap <span className="text-white">Notifications</span></li>
          <li><span className="text-orange-400 font-medium">4.</span> Turn on <span className="text-white">Allow Notifications</span></li>
          <li><span className="text-orange-400 font-medium">5.</span> Return here and tap <span className="text-white">Try Again</span></li>
        </ol>
      )}
      {platform === 'ios-browser' && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Push notifications on iOS require the app to be installed to your Home Screen. Once installed, you can grant permission from the app.</p>
          <ol className="text-sm text-zinc-400 space-y-2 list-none">
            <li><span className="text-orange-400 font-medium">1.</span> Open this site in <span className="text-white">Safari</span></li>
            <li><span className="text-orange-400 font-medium">2.</span> Tap the <span className="text-white">Share</span> button (box with arrow)</li>
            <li><span className="text-orange-400 font-medium">3.</span> Tap <span className="text-white">Add to Home Screen</span></li>
            <li><span className="text-orange-400 font-medium">4.</span> Open the app from your Home Screen</li>
            <li><span className="text-orange-400 font-medium">5.</span> Allow notifications when prompted</li>
          </ol>
        </div>
      )}
      {platform === 'android' && (
        <ol className="text-sm text-zinc-400 space-y-2 list-none">
          <li><span className="text-orange-400 font-medium">1.</span> In Chrome, tap the <span className="text-white">three-dot menu</span> (top right)</li>
          <li><span className="text-orange-400 font-medium">2.</span> Go to <span className="text-white">Settings → Site settings → Notifications</span></li>
          <li><span className="text-orange-400 font-medium">3.</span> Find this site and tap <span className="text-white">Allow</span></li>
          <li><span className="text-orange-400 font-medium">4.</span> Return here and tap <span className="text-white">Try Again</span></li>
        </ol>
      )}
      {platform === 'desktop' && (
        <ol className="text-sm text-zinc-400 space-y-2 list-none">
          <li><span className="text-orange-400 font-medium">1.</span> Click the <span className="text-white">lock icon</span> in the address bar</li>
          <li><span className="text-orange-400 font-medium">2.</span> Find <span className="text-white">Notifications</span> and set it to <span className="text-white">Allow</span></li>
          <li><span className="text-orange-400 font-medium">3.</span> Refresh the page, then tap <span className="text-white">Try Again</span></li>
        </ol>
      )}
    </div>
  )
}

function PWAInstallInstructions({ platform }: { platform: Platform }) {
  if (platform !== 'ios-browser') return null
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Install the app first</p>
      <p className="text-sm text-zinc-400">
        iOS requires the app to be installed to your Home Screen before push notifications can be enabled.
      </p>
      <ol className="text-sm text-zinc-400 space-y-2 list-none">
        <li><span className="text-orange-400 font-medium">1.</span> Tap the <span className="text-white">Share</span> button in Safari (box with arrow)</li>
        <li><span className="text-orange-400 font-medium">2.</span> Tap <span className="text-white">Add to Home Screen</span></li>
        <li><span className="text-orange-400 font-medium">3.</span> Open the app from your Home Screen</li>
        <li><span className="text-orange-400 font-medium">4.</span> Allow notifications when prompted</li>
      </ol>
    </div>
  )
}

export default function NotificationTroubleshootPage() {
  const { currentUser, loading, refreshCurrentUser } = useUser()
  const { permissionStatus, requestPermission } = useFCM()
  const router = useRouter()

  const [platform, setPlatform] = useState<Platform | null>(null)
  const [isPWA, setIsPWA] = useState<boolean | null>(null)
  const [testState, setTestState] = useState<TestState>('idle')
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (!loading && !currentUser) router.replace('/onboarding')
  }, [currentUser, loading, router])

  useEffect(() => {
    const p = detectPlatform()
    const pwa = window.matchMedia('(display-mode: standalone)').matches
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(p)
    setIsPWA(pwa)
    dbg('mount', { platform: p, isPWA: pwa, ua: navigator.userAgent })
  }, [])

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasTokens = !!(currentUser.fcmTokens?.length)
  const notificationsSupported = permissionStatus !== 'unsupported'

  // iOS in a regular browser can't get notifications — must be PWA
  const needsPWAInstall = platform === 'ios-browser'

  // Permission denied requires manual browser/OS fix
  const permissionDenied = permissionStatus === 'denied'

  // Has permission and tokens — can send test
  const canTest = hasTokens && permissionStatus === 'granted'

  // Has permission but no tokens — offer retry
  const canRetry = !hasTokens && permissionStatus !== 'denied' && notificationsSupported && !needsPWAInstall

  dbg('state', {
    userId: currentUser.id,
    permissionStatus,
    hasTokens,
    tokenCount: currentUser.fcmTokens?.length ?? 0,
    tokens: currentUser.fcmTokens?.map(t => t.slice(0, 20)),
    platform,
    isPWA,
    canTest,
    canRetry,
    needsPWAInstall,
    permissionDenied,
  })

  async function handleTest() {
    dbg('handleTest', { userId: currentUser!.id, tokenCount: currentUser!.fcmTokens?.length ?? 0 })
    setTestState('sending')
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser!.id }),
      })
      const data = await res.json()
      dbg('handleTest-response', { status: res.status, ok: res.ok, data })
      if (!res.ok && data.error === 'no_tokens') {
        setTestState('no_tokens')
      } else if (!res.ok || !data.sent) {
        setTestState('error')
      } else {
        setTestState('sent')
      }
    } catch (err) {
      dbg('handleTest-error', { error: String(err) })
      setTestState('error')
    }
  }

  async function handleRetry() {
    dbg('handleRetry-start', { userId: currentUser!.id, permissionStatus })
    setRetrying(true)
    const result = await requestPermission(currentUser!.id)
    dbg('handleRetry-permission', { result, newPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unknown' })
    await refreshCurrentUser()
    dbg('handleRetry-done', { tokenCount: currentUser!.fcmTokens?.length ?? 0 })
    setRetrying(false)
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-nav">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/settings/notifications"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Notification Setup</h1>
          <p className="text-xs text-zinc-500">Diagnose and fix push notifications</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Status checklist */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 divide-y divide-zinc-800">
          <StatusRow
            ok={notificationsSupported}
            label="Browser supports notifications"
          />
          <StatusRow
            ok={isPWA === null ? null : (platform !== 'ios-browser' || isPWA)}
            label={platform === 'ios-browser' ? 'Installed to Home Screen (required on iOS)' : 'App environment'}
          />
          <StatusRow
            ok={permissionStatus === 'granted' ? true : permissionStatus === 'default' ? null : false}
            label={
              permissionStatus === 'denied'
                ? 'Notification permission — blocked'
                : permissionStatus === 'granted'
                  ? 'Notification permission — allowed'
                  : 'Notification permission — not set'
            }
          />
          <StatusRow
            ok={hasTokens}
            label={hasTokens ? 'Device registered for push' : 'Device not registered — setup incomplete'}
          />
        </div>

        {/* iOS browser: needs PWA install */}
        {needsPWAInstall && (
          <PWAInstallInstructions platform={platform!} />
        )}

        {/* Permission denied: show fix instructions */}
        {permissionDenied && platform && (
          <FixInstructions platform={platform} permission={permissionStatus} />
        )}

        {/* Can retry registration */}
        {canRetry && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <p className="text-sm text-zinc-300">
              Permission is granted but your device isn&apos;t registered yet.
            </p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              {retrying ? 'Registering…' : 'Try Again'}
            </button>
          </div>
        )}

        {/* Test notification */}
        {canTest && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Send a test notification</p>
            <p className="text-sm text-zinc-400">
              Tap below and you should receive a push notification on your device within a few seconds.
            </p>

            {testState === 'idle' && (
              <button
                onClick={handleTest}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-colors"
              >
                Send Test Notification
              </button>
            )}

            {testState === 'sending' && (
              <div className="flex items-center justify-center gap-2 py-3 text-zinc-400 text-sm">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                Sending…
              </div>
            )}

            {testState === 'sent' && (
              <div className="space-y-3">
                <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-sm text-green-300">
                  Sent! Check your device — the notification should arrive shortly.
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  Didn&apos;t get it?{' '}
                  <button onClick={() => setTestState('idle')} className="text-orange-400 underline">
                    Try again
                  </button>
                  {' '}or check your device&apos;s Do Not Disturb settings.
                </p>
              </div>
            )}

            {(testState === 'no_tokens' || testState === 'error') && (
              <div className="space-y-3">
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-300">
                  {testState === 'no_tokens'
                    ? 'No registered device found. Try re-registering below.'
                    : 'Something went wrong sending the test. Try re-registering.'}
                </div>
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
                >
                  {retrying ? 'Re-registering…' : 'Re-register Device'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unsupported browser */}
        {!notificationsSupported && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-400">
              Push notifications aren&apos;t supported in this browser.
              {platform === 'ios-browser'
                ? ' On iOS, use Safari and install the app to your Home Screen.'
                : ' Try opening this site in Chrome or Safari.'}
            </p>
          </div>
        )}

        {/* All good */}
        {canTest && testState === 'idle' && hasTokens && permissionStatus === 'granted' && (
          <p className="text-xs text-zinc-600 text-center">
            Your setup looks correct. Use the test above to verify delivery.
          </p>
        )}
      </div>
    </div>
  )
}
