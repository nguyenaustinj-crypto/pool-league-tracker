"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLeagueAccess, requireLeagueManager, requireSignedIn } from "@/lib/access";
import { leavesNoManager, type LeagueRoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// Joining leagues, and managing who's in them. Each action checks on the
// server who's asking (see src/lib/access.ts): server actions accept direct
// POST requests, so the buttons being hidden isn't enough.

function revalidateMembership(leagueId: string) {
  revalidatePath("/");
  revalidatePath("/leagues/search");
  revalidatePath(`/leagues/${leagueId}/members`);
  revalidatePath(`/leagues/${leagueId}/join`);
}

/** Ask to join a league found through search. A manager has to approve it. */
export async function requestToJoin(leagueId: string) {
  const user = await requireSignedIn();
  const access = await getLeagueAccess(leagueId);
  if (access.role) redirect(`/leagues/${leagueId}`);

  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { id: true } });
  if (!league) throw new Error("That league doesn't exist.");

  await prisma.joinRequest.upsert({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    create: { leagueId, userId: user.id },
    // Asking again after a decline reopens the same request.
    update: { status: "PENDING", createdAt: new Date(), decidedAt: null },
  });
  revalidateMembership(leagueId);
  redirect(`/leagues/${leagueId}/join`);
}

async function pendingRequest(leagueId: string, requestId: string) {
  const request = await prisma.joinRequest.findUnique({ where: { id: requestId } });
  if (!request || request.leagueId !== leagueId || request.status !== "PENDING") {
    throw new Error("That request isn't waiting on an answer anymore.");
  }
  return request;
}

export async function approveJoinRequest(leagueId: string, requestId: string) {
  await requireLeagueManager(leagueId);
  const request = await pendingRequest(leagueId, requestId);

  await prisma.$transaction([
    prisma.leagueMembership.upsert({
      where: { leagueId_userId: { leagueId, userId: request.userId } },
      create: { leagueId, userId: request.userId, role: "PLAYER" },
      update: {},
    }),
    prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", decidedAt: new Date() },
    }),
  ]);
  revalidateMembership(leagueId);
}

export async function declineJoinRequest(leagueId: string, requestId: string) {
  await requireLeagueManager(leagueId);
  await pendingRequest(leagueId, requestId);

  await prisma.joinRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED", decidedAt: new Date() },
  });
  revalidateMembership(leagueId);
}

async function membersOf(leagueId: string, userId: string) {
  const members = await prisma.leagueMembership.findMany({
    where: { leagueId },
    select: { userId: true, role: true },
  });
  if (!members.some((m) => m.userId === userId)) {
    throw new Error("That person isn't in this league.");
  }
  return members;
}

const LAST_MANAGER =
  "A league needs at least one manager. Make someone else a manager first.";

export async function setMemberRole(leagueId: string, userId: string, role: LeagueRoleName) {
  await requireLeagueManager(leagueId);
  if (role !== "MANAGER" && role !== "PLAYER") throw new Error("Unknown role.");

  const members = await membersOf(leagueId, userId);
  if (leavesNoManager(members, userId, role)) throw new Error(LAST_MANAGER);

  await prisma.leagueMembership.update({
    where: { leagueId_userId: { leagueId, userId } },
    data: { role },
  });
  revalidateMembership(leagueId);
}

export async function removeMember(leagueId: string, userId: string) {
  await requireLeagueManager(leagueId);

  const members = await membersOf(leagueId, userId);
  if (leavesNoManager(members, userId, null)) throw new Error(LAST_MANAGER);

  await prisma.leagueMembership.delete({ where: { leagueId_userId: { leagueId, userId } } });
  revalidateMembership(leagueId);
}

/**
 * Site admins can see every league without being in it. This makes one a
 * manager of a league, e.g. to take over one that was created before
 * leagues had members.
 */
export async function addMeAsManager(leagueId: string) {
  const access = await getLeagueAccess(leagueId);
  if (!access.isSiteAdmin || !access.user) {
    throw new Error("Only site admins signed in with Google can do that.");
  }

  await prisma.leagueMembership.upsert({
    where: { leagueId_userId: { leagueId, userId: access.user.id } },
    create: { leagueId, userId: access.user.id, role: "MANAGER" },
    update: { role: "MANAGER" },
  });
  revalidateMembership(leagueId);
}
