"use server";

import { revalidatePath } from "next/cache";
import { getLeagueAccess, requireLeagueManager, requireSignedIn } from "@/lib/access";
import { redirectToLogin } from "@/lib/editor";
import { newInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";

// Linking accounts to roster names (Player.userId). A manager types a roster
// in, then either hands each player their own invite link (Player.inviteToken,
// which joins the league and takes that name), or people claim their own name
// in one tap. An account is at most one roster name per league, and a name
// belongs to at most one account. The link is what lets a player enter the
// scores for their own table.

async function playerInLeague(leagueId: string, playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: { select: { leagueId: true } } },
  });
  if (!player || player.team.leagueId !== leagueId) {
    throw new Error("That player isn't in this league.");
  }
  return player;
}

function linkedPlayerIn(leagueId: string, userId: string) {
  return prisma.player.findFirst({
    where: { userId, team: { leagueId } },
    select: { id: true, name: true },
  });
}

function revalidateLeague(leagueId: string) {
  revalidatePath(`/leagues/${leagueId}`, "layout");
}

/** "That's me": a member claims a roster name nobody has claimed yet. */
export async function claimPlayer(leagueId: string, playerId: string) {
  const user = await requireSignedIn();
  const access = await getLeagueAccess(leagueId);
  if (!access.role) throw new Error("Join the league before picking your name.");

  const player = await playerInLeague(leagueId, playerId);
  if (player.userId && player.userId !== user.id) {
    throw new Error("Someone already picked that name. Ask a league manager if that's a mistake.");
  }
  const existing = await linkedPlayerIn(leagueId, user.id);
  if (existing && existing.id !== playerId) {
    throw new Error(`You're already ${existing.name} in this league.`);
  }

  // Only claims a name that's still free, even if two people tap at once.
  // Taking the name also kills its invite link.
  await prisma.player.updateMany({
    where: { id: playerId, userId: null },
    data: { userId: user.id, inviteToken: null },
  });
  revalidateLeague(leagueId);
}

/** Undoes a link: a manager can for anyone; a member can for themselves ("That's not me"). */
export async function unlinkPlayer(leagueId: string, playerId: string) {
  const access = await getLeagueAccess(leagueId);
  const player = await playerInLeague(leagueId, playerId);
  const isSelf = Boolean(access.user) && player.userId === access.user?.id;
  if (!access.canManage && !isSelf) {
    if (!access.user) return redirectToLogin();
    throw new Error("Only a league manager can change someone else's name.");
  }

  await prisma.player.update({ where: { id: playerId }, data: { userId: null } });
  revalidateLeague(leagueId);
}

/** A manager links a member to a roster name, from the Members page. */
export async function linkMemberToPlayer(leagueId: string, userId: string, formData: FormData) {
  await requireLeagueManager(leagueId);

  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (!membership) throw new Error("That person isn't in this league.");

  const player = await playerInLeague(leagueId, String(formData.get("playerId") ?? ""));
  if (player.userId && player.userId !== userId) {
    throw new Error("That name is already linked to someone else. Unlink it first.");
  }
  const existing = await linkedPlayerIn(leagueId, userId);
  if (existing && existing.id !== player.id) {
    throw new Error(`They're already linked to ${existing.name}. Unlink that first.`);
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { userId, inviteToken: null },
  });
  revalidateLeague(leagueId);
}

/**
 * Creates (or replaces) the share link for one roster name, so a manager can
 * send each player a link that joins the league as that exact person.
 */
export async function createPlayerInvite(leagueId: string, playerId: string) {
  await requireLeagueManager(leagueId);
  const player = await playerInLeague(leagueId, playerId);
  if (player.userId) {
    throw new Error(`${player.name} is already linked to an account.`);
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { inviteToken: newInviteToken() },
  });
  revalidateLeague(leagueId);
}
