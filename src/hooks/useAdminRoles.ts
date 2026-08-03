'use client'

import { useEffect, useState } from 'react'
import type { AdminRolesResponse } from '@/app/api/admin/roles/route'
import type { AdminRole } from '@/lib/admin-auth'

/**
 * Which PAX are admins, for the ADMIN tag beside their name.
 *
 * One fetch per page load, shared by every caller through a module-level
 * promise. A feed screen renders this from dozens of components (each post,
 * each comment); a provider would do the same job with more wiring, and a
 * per-component fetch would be dozens of identical requests.
 *
 * The empty map is a fine answer: no tags, nothing broken. Nothing in the app
 * depends on this beyond decoration, so a failed fetch is swallowed.
 */
type RoleMap = Record<string, AdminRole>

let inflight: Promise<RoleMap> | null = null

function loadRoles(): Promise<RoleMap> {
  inflight ??= fetch('/api/admin/roles')
    .then(r => r.json() as Promise<AdminRolesResponse>)
    .then(data => data.roles ?? {})
    .catch(() => {
      // Let the next mount try again rather than caching a network blip for
      // the life of the tab.
      inflight = null
      return {}
    })
  return inflight
}

export function useAdminRoles(): RoleMap {
  const [roles, setRoles] = useState<RoleMap>({})

  useEffect(() => {
    let cancelled = false
    loadRoles().then(r => { if (!cancelled) setRoles(r) })
    return () => { cancelled = true }
  }, [])

  return roles
}

/** Test seam — drops the shared cache so a fresh fetch happens. */
export function resetAdminRolesCache(): void {
  inflight = null
}
