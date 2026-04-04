'use client'

import { useQuery } from '@tanstack/react-query'
import { UpdateBanner } from '@/components/ui/UpdateBanner'

const CURRENT_VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev'

async function fetchVersion(): Promise<string> {
  const res = await fetch('/api/version')
  const data = await res.json()
  return data.version
}

export function UpdateChecker() {
  const { data: latestVersion } = useQuery({
    queryKey: ['app-version'],
    queryFn: fetchVersion,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
  })

  const updateAvailable =
    CURRENT_VERSION !== 'dev' &&
    latestVersion !== undefined &&
    latestVersion !== CURRENT_VERSION

  return <UpdateBanner visible={updateAvailable} />
}
