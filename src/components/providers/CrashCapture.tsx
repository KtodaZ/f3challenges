'use client'

import { toast } from 'sonner'
import { ReadOnlyRegionError } from '@/lib/firestore'

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
      // A write refused because an admin is previewing another region isn't a
      // crash — it's the guard doing its job. Every write path in the app is
      // fire-and-forget to some degree, so catching it centrally is what
      // guarantees the person actually finds out instead of watching a rep
      // count silently revert on the next refresh.
      if (event.reason instanceof ReadOnlyRegionError) {
        event.preventDefault()
        toast.error(event.reason.message)
        return
      }
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
