'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { isNetworkBlockedError } from '@/lib/query-client'

export function useFirestoreConnection() {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    // Try a lightweight probe read — just check if Firestore is reachable
    const probe = async () => {
      try {
        await getDocs(query(collection(db, 'users'), limit(1)))
      } catch (err) {
        if (isNetworkBlockedError(err)) {
          setBlocked(true)
        }
      }
    }
    probe()
  }, [])

  return { blocked }
}
