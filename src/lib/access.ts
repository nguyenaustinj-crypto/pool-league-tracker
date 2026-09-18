import { cache } from "react";
import { redirect } from "next/navigation";
import { isSiteAdmin, redirectToLogin } from "@/lib/editor";
import { leaguePermissions, type LeagueRoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Who can see and change each league. Leagues are members-only, and only a
// league's managers (or site admins) can change it.
//
// - Every league page calls requireLeagueView / requireLeagueManagerPage
//   first. The check lives in each page, not a shared layout, because
//   layouts don't re-run on every navigation (see Next's authentication
//   guide), so a layout check can be skipped.
// - Every server action that changes a league calls requireLeagueManager
//   first. Server actions accept direct POST requests, so hiding buttons
//   isn't protection.

export const getLeagueAccess = cache(async (leagueId: string) => {
  const [user, siteAdmin] = await Promise.all([getCurrentUser(), isSiteAdmin()]);
  const membership = user
    ? await prisma.leagueMembership.findUnique({
        where: { leagueId_userId: { leagueId, userId: user.id } },
        select: { role: true },
      })
    : null;
  const role: LeagueRoleName | null = membership?.role ?? null;
  return {
    user,
    role,
    isSiteAdmin: siteAdmin,
    ...leaguePermissions({ isSiteAdmin: siteAdmin, role }),
  };
});

export type LeagueAccess = Awaited<ReturnType<typeof getLeagueAccess>>;

/** For every league page: members and site admins only. */
export async function requireLeagueView(leagueId: string, returnTo: string): Promise<LeagueAccess> {
  const access = await getLeagueAccess(leagueId);
  if (access.canView) return access;
  if (!access.user) return redirectToLogin(returnTo);
  // Signed in but not a member: offer to ask to join.
  redirect(`/leagues/${leagueId}/join`);
}

/** For pages that only managers use (editing, new match, members). */
export async function requireLeagueManagerPage(
  leagueId: string,
  returnTo: string
): Promise<LeagueAccess> {
  const access = await requireLeagueView(leagueId, returnTo);
  if (!access.canManage) redirect(`/leagues/${leagueId}`);
  return access;
}

/** First line of every server action that changes a league. */
export async function requireLeagueManager(leagueId: string): Promise<LeagueAccess> {
  const access = await getLeagueAccess(leagueId);
  if (access.canManage) return access;
  if (!access.user && !access.isSiteAdmin) return redirectToLogin();
  throw new Error("Only this league's managers can make that change.");
}

/** For the one change that's too destructive for managers: deleting a league. */
export async function requireLeagueDelete(leagueId: string): Promise<LeagueAccess> {
  const access = await getLeagueAccess(leagueId);
  if (access.canDelete) return access;
  if (!access.user) return redirectToLogin();
  throw new Error("Only site admins can delete a league.");
}

/** For pages and actions that just need someone signed in with Google. */
export async function requireSignedIn(returnTo?: string) {
  const user = await getCurrentUser();
  if (!user) return redirectToLogin(returnTo);
  return user;
}
