'use client'

import { useQuery } from '@tanstack/react-query'
import { getAllUsers } from '@/lib/firestore'
import { useRegion } from '@/contexts/RegionContext'
import { selectRoster } from '@/lib/roster'

/**
 * The region's ROSTER — active crew only, archived PAX filtered out. Anything
 * that needs to resolve an archived PAX (feed authorship, historical results)
 * must use `allUsers` from UserContext instead, not this hook.
 */
export function useUsers() {
  const { regionId, ready } = useRegion()
  return useQuery({
    queryKey: ['users', regionId],
    queryFn: () => getAllUsers(regionId).then(selectRoster),
    enabled: ready,
    staleTime: 60_000, // users list doesn't change often
  })
}
