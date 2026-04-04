'use client'

import { useEffect } from 'react'

const DBG = process.env.NEXT_PUBLIC_DEBUG_URL

function post(label: string, data: unknown) {
  if (!DBG) return
  fetch(DBG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, src: 'client', data }),
  }).catch(() => {})
}

export function CrashCapture() {
  useEffect(() => {
    const origError = console.error.bind(console)
    console.error = (...args: unknown[]) => {
      post('console.error', { args: args.map(String), url: location.href })
      origError(...args)
    }

    function onError(event: ErrorEvent) {
      post('uncaught-error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        url: location.href,
      })
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      post('unhandled-rejection', {
        reason: String(event.reason),
        stack: event.reason?.stack,
        url: location.href,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      console.error = origError
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
