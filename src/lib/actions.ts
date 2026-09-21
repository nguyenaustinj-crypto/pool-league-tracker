"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLeagueDelete, requireLeagueManager } from "@/lib/access";
import { isSiteAdmin, redirectToLogin } from "@/lib/editor";
import { newInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";
import { cardScoresOf, type CardScores, type CardStatus } from "@/lib/score-entry";
import { awayIndexForRound } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/session";

// Every action that changes a league first checks the caller may manage
// that league (src/lib/access.ts), then checks that every id it was handed
// actually belongs to that league, so a manager of one league can't reach
// into another by passing its ids. Server actions accept direct POST
// requests, so neither check can be left to the UI.

async function teamInLeague(leagueId: string, teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.leagueId !== leagueId) throw new Error("That team isn't in this league.");
  return team;
}

async function playerInLeague(leagueId: string, playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true },
  });
  if (!player || player.team.leagueId !== leagueId) {
    throw new Error("That player isn't in this league.");
  }
  return player;
}

async function matchInLeague(leagueId: string, matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.leagueId !== leagueId) throw new Error("That match isn't in this league.");
  return match;
}

export async function createLeague(formData: FormData) {
  // Anyone signed in can start a league, and becomes its manager. (A site
  // admin using the editor passcode has no account, so gets no membership.)
  const [user, siteAdmin] = await Promise.all([getCurrentUser(), isSiteAdmin()]);
  if (!user && !siteAdmin) return redirectToLogin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const league = await prisma.league.create({
    data: {
      name,
      // Every league starts with a player invite link its members can share.
      inviteToken: newInviteToken(),
      ...(user ? { memberships: { create: { userId: user.id, role: "MANAGER" as const } } } : {}),
    },
  });
  revalidatePath("/");
  // Straight to inviting people (which they can skip).
  redirect(`/leagues/${league.id}/setup`);
}

export async function updateLeague(leagueId: string, formData: FormData) {
  await requireLeagueManager(leagueId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.league.update({ where: { id: leagueId }, data: { name } });
  revalidatePath("/");
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/teams`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  redirect(`/leagues/${leagueId}`);
}

export async function deleteLeague(leagueId: string, formData: FormData) {
  await requireLeagueDelete(leagueId);

  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const confirmation = String(formData.get("confirmName") ?? "").trim();
  if (confirmation !== league.name) {
    throw new Error("Typed name didn't match — league not deleted.");
  }

  await prisma.league.delete({ where: { id: leagueId } });
  revalidatePath("/");
  redirect("/");
}

export async function createTeam(leagueId: string, formData: FormData) {
  await requireLeagueManager(leagueId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.team.create({ data: { name, leagueId } });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/teams`);
}

export async function updateTeam(leagueId: string, teamId: string, formData: FormData) {
  await requireLeagueManager(leagueId);
  await teamInLeague(leagueId, teamId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.team.update({ where: { id: teamId }, data: { name } });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/teams`);
  revalidatePath(`/leagues/${leagueId}/teams/${teamId}`);
  redirect(`/leagues/${leagueId}/teams/${teamId}`);
}

export async function deleteTeam(leagueId: string, teamId: string) {
  await requireLeagueManager(leagueId);
  await teamInLeague(leagueId, teamId);

  const matchCount = await prisma.match.count({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  });
  if (matchCount > 0) {
    throw new Error(
      "This team has played in an existing match — that match must be deleted first."
    );
  }

  await prisma.team.delete({ where: { id: teamId } });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/teams`);
  redirect(`/leagues/${leagueId}/teams`);
}

export async function createPlayer(leagueId: string, teamId: string, formData: FormData) {
  await requireLeagueManager(leagueId);
  await teamInLeague(leagueId, teamId);

  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  await prisma.player.create({ data: { name, rating, teamId } });
  revalidatePath(`/leagues/${leagueId}/teams`);
  revalidatePath(`/leagues/${leagueId}/teams/${teamId}`);
}

export async function updatePlayer(leagueId: string, playerId: string, formData: FormData) {
  await requireLeagueManager(leagueId);
  await playerInLeague(leagueId, playerId);

  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  const player = await prisma.player.update({ where: { id: playerId }, data: { name, rating } });
  revalidatePath(`/leagues/${leagueId}/teams/${player.teamId}`);
  redirect(`/leagues/${leagueId}/teams/${player.teamId}`);
}

export async function deletePlayer(leagueId: string, playerId: string) {
  await requireLeagueManager(leagueId);
  const player = await playerInLeague(leagueId, playerId);

  const pairingCount = await prisma.pairing.count({
    where: { OR: [{ homePlayerId: playerId }, { awayPlayerId: playerId }] },
  });
  if (pairingCount > 0) {
    throw new Error(
      "This player is part of an existing match's lineup — remove them from that match first."
    );
  }

  await prisma.player.delete({ where: { id: playerId } });
  revalidatePath(`/leagues/${leagueId}/teams/${player.teamId}`);
  redirect(`/leagues/${leagueId}/teams/${player.teamId}`);
}

async function validateLineup(
  leagueId: string,
  homeTeamId: string,
  awayTeamId: string,
  homePlayerIds: string[],
  awayPlayerIds: string[]
) {
  if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
    throw new Error("Pick two different teams for this match.");
  }
  const tableCount = homePlayerIds.length;
  if (tableCount === 0 || awayPlayerIds.length !== tableCount) {
    throw new Error("Pick one player per table for each side.");
  }
  if (new Set(homePlayerIds).size !== tableCount || new Set(awayPlayerIds).size !== tableCount) {
    throw new Error("Each player can only be picked for one table on their side.");
  }

  const teams = await prisma.team.findMany({ where: { id: { in: [homeTeamId, awayTeamId] } } });
  if (teams.length !== 2 || teams.some((t) => t.leagueId !== leagueId)) {
    throw new Error("Both teams must belong to this league.");
  }

  const allIds = [...homePlayerIds, ...awayPlayerIds];
  const players = await prisma.player.findMany({ where: { id: { in: allIds } } });
  if (players.length !== allIds.length) {
    throw new Error("All players must exist.");
  }
  const homeSet = new Set(homePlayerIds);
  for (const player of players) {
    const expectedTeamId = homeSet.has(player.id) ? homeTeamId : awayTeamId;
    if (player.teamId !== expectedTeamId) {
      throw new Error(`${player.name} isn't on that side's team.`);
    }
  }
}

// Keyed by `${roundNumber}:${homePlayerId}:${awayPlayerId}` so a table-count
// or lineup change on a match that already has scores can carry forward the
// scores for any pairing that lands in the same spot again, instead of
// wiping the whole match. Round 1 pairings (home[i] vs away[i]) are always
// stable across a table-count change; later rounds are stable only where the
// round-robin rotation happens to still line up.
// Each card's status travels with its scores. Its edit history doesn't: the
// old pairings (and their history) are deleted when the lineup changes.
type PreservedScores = Map<
  string,
  CardScores & { status: CardStatus; enteredById: string | null; confirmedById: string | null }
>;

function pairingKey(roundNumber: number, homePlayerId: string, awayPlayerId: string) {
  return `${roundNumber}:${homePlayerId}:${awayPlayerId}`;
}

function roundsCreateData(
  homePlayerIds: string[],
  awayPlayerIds: string[],
  preserved?: PreservedScores
) {
  const tableCount = homePlayerIds.length;
  return Array.from({ length: tableCount }, (_, roundIndex) => {
    const roundNumber = roundIndex + 1;
    return {
      roundNumber,
      pairings: {
        create: homePlayerIds.map((homePlayerId, homeIndex) => {
          const awayPlayerId = awayPlayerIds[awayIndexForRound(homeIndex, roundIndex, tableCount)];
          return {
            tableNumber: homeIndex + 1,
            homePlayerId,
            awayPlayerId,
            ...preserved?.get(pairingKey(roundNumber, homePlayerId, awayPlayerId)),
          };
        }),
      },
    };
  });
}

export async function createMatch(leagueId: string, formData: FormData) {
  await requireLeagueManager(leagueId);

  const homeTeamId = String(formData.get("homeTeamId") ?? "");
  const awayTeamId = String(formData.get("awayTeamId") ?? "");
  const homePlayerIds = formData.getAll("homePlayerIds").map(String);
  const awayPlayerIds = formData.getAll("awayPlayerIds").map(String);

  await validateLineup(leagueId, homeTeamId, awayTeamId, homePlayerIds, awayPlayerIds);

  const match = await prisma.match.create({
    data: {
      leagueId,
      homeTeamId,
      awayTeamId,
      rounds: { create: roundsCreateData(homePlayerIds, awayPlayerIds) },
    },
  });

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  redirect(`/leagues/${leagueId}/matches/${match.id}`);
}

function sortedIds(ids: string[]) {
  return [...ids].sort().join(",");
}

export async function updateMatch(leagueId: string, matchId: string, formData: FormData) {
  await requireLeagueManager(leagueId);
  const currentMatch = await matchInLeague(leagueId, matchId);

  const dateValue = String(formData.get("date") ?? "");
  const homeTeamId = String(formData.get("homeTeamId") ?? "");
  const awayTeamId = String(formData.get("awayTeamId") ?? "");
  const homePlayerIds = formData.getAll("homePlayerIds").map(String);
  const awayPlayerIds = formData.getAll("awayPlayerIds").map(String);

  await validateLineup(leagueId, homeTeamId, awayTeamId, homePlayerIds, awayPlayerIds);

  // The edit form always submits a full lineup (pre-checked with the
  // current one), so only regenerate Rounds/Pairings if the teams, lineup,
  // or table count actually changed from what's saved.
  const currentRounds = await prisma.round.findMany({
    where: { matchId },
    include: { pairings: true },
  });
  const firstRound = currentRounds.find((r) => r.roundNumber === 1);
  const currentHomeIds = firstRound?.pairings.map((p) => p.homePlayerId) ?? [];
  const currentAwayIds = firstRound?.pairings.map((p) => p.awayPlayerId) ?? [];
  const lineupChanged =
    homeTeamId !== currentMatch.homeTeamId ||
    awayTeamId !== currentMatch.awayTeamId ||
    sortedIds(homePlayerIds) !== sortedIds(currentHomeIds) ||
    sortedIds(awayPlayerIds) !== sortedIds(currentAwayIds);

  if (lineupChanged) {
    // Regenerating Rounds/Pairings from scratch would normally wipe any
    // scores entered so far -- e.g. when the table count changes mid-match.
    // Carry forward the score for any pairing that lands in the same
    // round/home-player/away-player spot in the new schedule, and only
    // leave blank the pairings that genuinely don't exist anymore.
    const preserved: PreservedScores = new Map();
    for (const round of currentRounds) {
      for (const pairing of round.pairings) {
        preserved.set(pairingKey(round.roundNumber, pairing.homePlayerId, pairing.awayPlayerId), {
          ...cardScoresOf(pairing),
          status: pairing.status,
          enteredById: pairing.enteredById,
          confirmedById: pairing.confirmedById,
        });
      }
    }

    // Cascades to the old rounds' pairings; the new ones are created in the
    // same update below with any preserved scores carried over.
    await prisma.round.deleteMany({ where: { matchId } });

    await prisma.match.update({
      where: { id: matchId },
      data: {
        ...(dateValue ? { date: new Date(dateValue) } : {}),
        homeTeamId,
        awayTeamId,
        rounds: { create: roundsCreateData(homePlayerIds, awayPlayerIds, preserved) },
      },
    });
  } else {
    await prisma.match.update({
      where: { id: matchId },
      data: {
        ...(dateValue ? { date: new Date(dateValue) } : {}),
        homeTeamId,
        awayTeamId,
      },
    });
  }

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  revalidatePath(`/leagues/${leagueId}/matches/${matchId}`);
  redirect(`/leagues/${leagueId}/matches/${matchId}`);
}

export async function deleteMatch(leagueId: string, matchId: string) {
  await requireLeagueManager(leagueId);
  await matchInLeague(leagueId, matchId);

  await prisma.match.delete({ where: { id: matchId } });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  redirect(`/leagues/${leagueId}/matches`);
}

// Scores are entered one card at a time: see src/lib/score-actions.ts. (The
// old whole-match save could overwrite another table's scores.)
