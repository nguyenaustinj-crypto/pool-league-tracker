// What someone may do in one league, from who they are site-wide and their
// role in that league. Pure (no database or Next.js), so the rules are
// unit-tested directly in permissions.test.ts; src/lib/access.ts applies
// them to the signed-in user.

export type LeagueRoleName = "MANAGER" | "PLAYER";

export interface LeaguePermissions {
  /** See the league's standings, teams, and matches. */
  canView: boolean;
  /** Change rosters, matches, scores, and settings; handle join requests. */
  canManage: boolean;
  /** Delete the whole league. Too destructive to leave to league managers. */
  canDelete: boolean;
}

export function leaguePermissions({
  isSiteAdmin,
  role,
}: {
  isSiteAdmin: boolean;
  role: LeagueRoleName | null;
}): LeaguePermissions {
  return {
    canView: isSiteAdmin || role !== null,
    canManage: isSiteAdmin || role === "MANAGER",
    canDelete: isSiteAdmin,
  };
}

/**
 * Whether changing one member's role (or removing them, newRole = null)
 * would take away the league's last manager. Only a change that demotes or
 * removes a current manager can do that.
 */
export function leavesNoManager(
  members: { userId: string; role: LeagueRoleName }[],
  userId: string,
  newRole: LeagueRoleName | null
): boolean {
  const target = members.find((m) => m.userId === userId);
  if (target?.role !== "MANAGER" || newRole === "MANAGER") return false;
  return !members.some((m) => m.userId !== userId && m.role === "MANAGER");
}

/** Tidies a league search. Null means there's nothing worth searching for. */
export function normalizeLeagueSearch(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const query = raw.trim().replace(/\s+/g, " ").slice(0, 60);
  return query.length >= 2 ? query : null;
}
