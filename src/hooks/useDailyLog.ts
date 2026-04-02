'use client'

import { useQuery } from '@tanstack/react-query'
import { getDailyLog } from '@/lib/firestore'
import { getTodayPT } from '@/lib/challenges'

export function useDailyLog(userId: string | null | undefined, date?: string) {
  const targetDate = date ?? getTodayPT()
  return useQuery({
    queryKey: ['dailyLog', userId, targetDate],
    queryFn: () => getDailyLog(userId!, targetDate),
    enabled: !!userId,
    staleTime: 10_000,
  })
}
