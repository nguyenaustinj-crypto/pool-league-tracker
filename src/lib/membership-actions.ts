"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLeagueAccess, requireLeagueManager, requireSignedIn } from "@/lib/access";
import { hashInviteToken, managerInviteExpiry, newInviteToken } from "@/lib/invite-token";
import { resolveInvite, siteOrigin } from "@/lib/invites";
import { leavesNoManager, type LeagueRoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// Joining leagues, invites, and managing who's in them. Each action checks
// on the server who's asking (see src/lib/access.ts): server actions accept
// direct POST requests, so the buttons being hidden isn't enough.

function revalidateMembership(leagueId: string) {
  revalidatePath("/");
  revalidatePath("/leagues/search");
  revalidatePath(`/leagues/${leagueId}/members`);
  revalidatePath(`/leagues/${leagueId}/join`);
}

// ---------------------------------------------------------------------------
// Asking the league's managers
// ---------------------------------------------------------------------------

/** Ask to join a league found through search. A manager has to approve it. */
export async function requestToJoin(leagueId: string) {
  const user = await requireSignedIn();
  const access = await getLeagueAccess(leagueId);
  if (access.role) redirect(`/leagues/${leagueId}`);

  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { id: true } });
  if (!league) throw new Error("That league doesn't exist.");

  await prisma.joinRequest.upsert({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    create: { leagueId, userId: user.id, role: "PLAYER" },
    // Asking again after a decline reopens the same request.
    update: { role: "PLAYER", status: "PENDING", createdAt: new Date(), decidedAt: null },
  });
  revalidateMembership(leagueId);
  redirect(`/leagues/${leagueId}/join`);
}

/** A player asking to be made one of the league's managers. */
export async function requestManagerRole(leagueId: string) {
  const user = await requireSignedIn();
  const access = await getLeagueAccess(leagueId);
  if (!access.canRequestManager) {
    throw new Error("Only players in this league can ask to be a manager.");
  }

  await prisma.joinRequest.upsert({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    create: { leagueId, userId: user.id, role: "MANAGER" },
    update: { role: "MANAGER", status: "PENDING", createdAt: new Date(), decidedAt: null },
  });
  revalidateMembership(leagueId);
}

// ---------------------------------------------------------------------------
// Answering requests, and managing members (managers only)
// ---------------------------------------------------------------------------

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
      create: { leagueId, userId: request.userId, role: request.role },
      // A manager request promotes; a join request never demotes anyone.
      update: request.role === "MANAGER" ? { role: "MANAGER" } : {},
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
  if (role === "MANAGER") {
    // Promoting someone answers any request they'd made to be a manager.
    await prisma.joinRequest.updateMany({
      where: { leagueId, userId, status: "PENDING", role: "MANAGER" },
      data: { status: "APPROVED", decidedAt: new Date() },
    });
  }
  revalidateMembership(leagueId);
}

export async function removeMember(leagueId: string, userId: string) {
  await requireLeagueManager(leagueId);

  const members = await membersOf(leagueId, userId);
  if (leavesNoManager(members, userId, null)) throw new Error(LAST_MANAGER);

  await prisma.$transaction([
    prisma.leagueMembership.delete({ where: { leagueId_userId: { leagueId, userId } } }),
    // Free up the roster name they'd claimed in this league.
    prisma.player.updateMany({ where: { userId, team: { leagueId } }, data: { userId: null } }),
    // Don't leave a request behind that would let them straight back in.
    prisma.joinRequest.updateMany({
      where: { leagueId, userId, status: "PENDING" },
      data: { status: "DECLINED", decidedAt: new Date() },
    }),
  ]);
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

// ---------------------------------------------------------------------------
// Invite links
// ---------------------------------------------------------------------------

/**
 * Creates the league's reusable player invite link, or replaces it so the
 * old one stops working. Managers only.
 */
export async function resetPlayerInviteLink(leagueId: string) {
  await requireLeagueManager(leagueId);
  await prisma.league.update({ where: { id: leagueId }, data: { inviteToken: newInviteToken() } });
  revalidateMembership(leagueId);
}

export interface ManagerInviteState {
  url: string | null;
}

/**
 * Creates a one-time manager invite link, returned so it can be shown once.
 * Only a hash of it is stored. Managers only. Used with useActionState, which
 * also passes the previous state; it isn't needed here.
 */
export async function createManagerInvite(leagueId: string): Promise<ManagerInviteState> {
  const access = await requireLeagueManager(leagueId);
  const token = newInviteToken();
  await prisma.managerInvite.create({
    data: {
      leagueId,
      tokenHash: hashInviteToken(token),
      createdById: access.user?.id ?? null,
      expiresAt: managerInviteExpiry(),
    },
  });
  return { url: `${await siteOrigin()}/invite/${token}` };
}

/** Uses an invite link: joins the league as a player, or becomes a manager. */
export async function acceptInvite(token: string) {
  const user = await requireSignedIn(`/invite/${token}`);
  const invite = await resolveInvite(token);
  if (!invite) throw new Error("This invite link isn't valid anymore.");
  const { leagueId, role, managerInviteId } = invite;

  if (role === "MANAGER" && managerInviteId) {
    await prisma.$transaction(
      async (tx) => {
        // Claim the one-time invite before anything else, so two people
        // opening the same link at once can't both use it.
        const claimed = await tx.managerInvite.updateMany({
          where: { id: managerInviteId, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date(), usedById: user.id },
        });
        if (claimed.count !== 1) throw new Error("This invite link has already been used.");

        await tx.leagueMembership.upsert({
          where: { leagueId_userId: { leagueId, userId: user.id } },
          create: { leagueId, userId: user.id, role: "MANAGER" },
          update: { role: "MANAGER" },
        });
      },
      // Prisma Postgres is remote; the default transaction timeouts are tight.
      { maxWait: 10_000, timeout: 20_000 }
    );
  } else if (invite.playerId) {
    // A link for one roster name: join, and take that name.
    const alreadyNamed = await prisma.player.findFirst({
      where: { userId: user.id, team: { leagueId } },
      select: { name: true },
    });
    if (alreadyNamed) throw new Error(`You're already ${alreadyNamed.name} in this league.`);

    await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.player.updateMany({
          where: { id: invite.playerId!, userId: null },
          data: { userId: user.id, inviteToken: null },
        });
        if (claimed.count !== 1) {
          throw new Error("Someone already took that name. Ask a league manager for a new link.");
        }
        await tx.leagueMembership.upsert({
          where: { leagueId_userId: { leagueId, userId: user.id } },
          create: { leagueId, userId: user.id, role: "PLAYER" },
          update: {},
        });
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
  } else {
    await prisma.leagueMembership.upsert({
      where: { leagueId_userId: { leagueId, userId: user.id } },
      create: { leagueId, userId: user.id, role: "PLAYER" },
      // Someone already in the league keeps their role.
      update: {},
    });
  }

  // The invite answers any matching request they'd made.
  await prisma.joinRequest.updateMany({
    where: {
      leagueId,
      userId: user.id,
      status: "PENDING",
      ...(role === "PLAYER" ? { role: "PLAYER" as const } : {}),
    },
    data: { status: "APPROVED", decidedAt: new Date() },
  });

  revalidateMembership(leagueId);
  redirect(`/leagues/${leagueId}`);
}
