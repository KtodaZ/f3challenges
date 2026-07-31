'use client'

import { useQuery } from '@tanstack/react-query'
import { getAllUsers } from '@/lib/firestore'
import { useRegion } from '@/contexts/RegionContext'

export function useUsers() {
  const { regionId, ready } = useRegion()
  return useQuery({
    queryKey: ['users', regionId],
    queryFn: () => getAllUsers(regionId),
    enabled: ready,
    staleTime: 60_000, // users list doesn't change often
  })
}
