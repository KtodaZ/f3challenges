'use client'

import { useFirestoreConnection } from '@/hooks/useFirestoreConnection'
import { FirestoreErrorBanner } from '@/components/ui/FirestoreErrorBanner'

export function FirestoreConnectionGuard() {
  const { blocked } = useFirestoreConnection()
  return <FirestoreErrorBanner visible={blocked} />
}
