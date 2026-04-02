import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s before refetch
      gcTime: 5 * 60_000,      // 5min cache
      retry: (failureCount, error) => {
        // Don't retry network-blocked errors (ad blocker)
        if (isNetworkBlockedError(error)) return false
        return failureCount < 2
      },
    },
  },
})

export function isNetworkBlockedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('err_blocked_by_client') ||
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    msg.includes('transport errored') ||    // Firestore WebChannel error
    msg.includes('websocket') ||
    (error as { code?: string }).code === 'unavailable'  // Firestore offline code
  )
}
