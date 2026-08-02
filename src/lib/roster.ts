/**
 * Roster vs. directory.
 *
 * The user query (`subscribeToUsers` / `getAllUsers`) returns every PAX in a
 * region regardless of `status` — one equality filter, no extra index. The
 * split between "who is currently in the crew" and "everyone we can still name"
 * happens here, in memory:
 *
 * - DIRECTORY (unfiltered) — resolving a PAX you already have an id or a name
 *   for: feed authorship, comment authors, reaction names, mention parsing on
 *   an existing post, profile pages, historical badge winners. Archived PAX
 *   keep every log, badge and post, so history must still resolve them.
 * - ROSTER (`selectRoster`) — presenting the active membership: leaderboard
 *   rows, crew counts, the onboarding name picker, mention autocomplete.
 *
 * Rule of thumb: picking or counting people → roster; looking a person up →
 * directory.
 */

/** Absent `status` means active — the field is only written when archiving. */
export function isArchived(user: { status?: string }): boolean {
  return user.status === 'archived'
}

/** The active crew: everyone except archived PAX. Order is preserved. */
export function selectRoster<T extends { status?: string }>(users: T[]): T[] {
  return users.filter(u => !isArchived(u))
}

interface NameHolder {
  id?: string
  displayName?: string
  formerNames?: string[]
}

/**
 * Whether an F3 name is already spoken for in this region's directory.
 *
 * Checks current names, names of ARCHIVED PAX, and names anyone has previously
 * been renamed away from. All three matter for the same reason: mentions are
 * stored as raw `@Name` text and resolved at render time by matching
 * `displayName`. A name that gets reused doesn't just collide going forward —
 * it retroactively re-points every historical mention of the previous holder
 * at whoever took it.
 *
 * Pass the DIRECTORY, not the roster.
 */
export function isNameTaken(
  directory: NameHolder[],
  name: string,
  exceptUserId?: string
): boolean {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return false

  return directory.some(u => {
    if (exceptUserId && u.id === exceptUserId) return false
    if ((u.displayName ?? '').toLowerCase() === wanted) return true
    return (u.formerNames ?? []).includes(wanted)
  })
}
