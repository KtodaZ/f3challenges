'use client'

import { useQuery } from '@tanstack/react-query'
import { getAllUsers } from '@/lib/firestore'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
    staleTime: 60_000, // users list doesn't change often
  })
}
