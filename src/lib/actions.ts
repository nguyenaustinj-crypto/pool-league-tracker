"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { awayIndexForRound } from "@/lib/scoring";

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.league.create({ data: { name } });
  revalidatePath("/");
}

export async function updateLeague(leagueId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.league.update({ where: { id: leagueId }, data: { name } });
  revalidatePath("/");
  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/leagues/${leagueId}`);
}

export async function deleteLeague(leagueId: string, formData: FormData) {
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
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.team.create({ data: { name, leagueId } });
  revalidatePath(`/leagues/${leagueId}`);
}

export async function updateTeam(leagueId: string, teamId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.team.update({ where: { id: teamId }, data: { name } });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/teams/${teamId}`);
  redirect(`/leagues/${leagueId}/teams/${teamId}`);
}

export async function deleteTeam(leagueId: string, teamId: string) {
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
  redirect(`/leagues/${leagueId}`);
}

export async function createPlayer(leagueId: string, teamId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  await prisma.player.create({ data: { name, rating, teamId } });
  revalidatePath(`/leagues/${leagueId}/teams/${teamId}`);
}

export async function updatePlayer(leagueId: string, playerId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  const player = await prisma.player.update({ where: { id: playerId }, data: { name, rating } });
  revalidatePath(`/leagues/${leagueId}/teams/${player.teamId}`);
  redirect(`/leagues/${leagueId}/teams/${player.teamId}`);
}

export async function deletePlayer(leagueId: string, playerId: string) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
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

function roundsCreateData(homePlayerIds: string[], awayPlayerIds: string[]) {
  const tableCount = homePlayerIds.length;
  return Array.from({ length: tableCount }, (_, roundIndex) => ({
    roundNumber: roundIndex + 1,
    pairings: {
      create: homePlayerIds.map((homePlayerId, homeIndex) => ({
        homePlayerId,
        awayPlayerId: awayPlayerIds[awayIndexForRound(homeIndex, roundIndex, tableCount)],
      })),
    },
  }));
}

export async function createMatch(leagueId: string, formData: FormData) {
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
  redirect(`/leagues/${leagueId}/matches/${match.id}`);
}

function sortedIds(ids: string[]) {
  return [...ids].sort().join(",");
}

export async function updateMatch(leagueId: string, matchId: string, formData: FormData) {
  const dateValue = String(formData.get("date") ?? "");
  const homeTeamId = String(formData.get("homeTeamId") ?? "");
  const awayTeamId = String(formData.get("awayTeamId") ?? "");
  const homePlayerIds = formData.getAll("homePlayerIds").map(String);
  const awayPlayerIds = formData.getAll("awayPlayerIds").map(String);

  await validateLineup(leagueId, homeTeamId, awayTeamId, homePlayerIds, awayPlayerIds);

  const currentMatch = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });

  // The edit form always submits a full lineup (pre-checked with the
  // current one), so only regenerate Rounds/Pairings -- wiping any scores
  // entered so far -- if the teams or lineup actually changed from what's
  // saved.
  const currentRound = await prisma.round.findFirst({
    where: { matchId, roundNumber: 1 },
    include: { pairings: true },
  });
  const currentHomeIds = currentRound?.pairings.map((p) => p.homePlayerId) ?? [];
  const currentAwayIds = currentRound?.pairings.map((p) => p.awayPlayerId) ?? [];
  const lineupChanged =
    homeTeamId !== currentMatch.homeTeamId ||
    awayTeamId !== currentMatch.awayTeamId ||
    sortedIds(homePlayerIds) !== sortedIds(currentHomeIds) ||
    sortedIds(awayPlayerIds) !== sortedIds(currentAwayIds);

  if (lineupChanged) {
    // Cascades to the old rounds' pairings, erasing any scores entered so
    // far. The edit form warns about this before submitting.
    await prisma.round.deleteMany({ where: { matchId } });
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(dateValue ? { date: new Date(dateValue) } : {}),
      homeTeamId,
      awayTeamId,
      ...(lineupChanged ? { rounds: { create: roundsCreateData(homePlayerIds, awayPlayerIds) } } : {}),
    },
  });

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/matches/${matchId}`);
  redirect(`/leagues/${leagueId}/matches/${matchId}`);
}

export async function deleteMatch(leagueId: string, matchId: string) {
  await prisma.match.delete({ where: { id: matchId } });
  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/leagues/${leagueId}`);
}

export interface PairingScoreUpdate {
  pairingId: string;
  homeGame1: number;
  homeGame2: number;
  awayGame1: number;
  awayGame2: number;
}

export async function saveMatchScores(
  leagueId: string,
  matchId: string,
  updates: PairingScoreUpdate[]
) {
  await prisma.$transaction(
    updates.map((u) =>
      prisma.pairing.update({
        where: { id: u.pairingId },
        data: {
          homeGame1: u.homeGame1,
          homeGame2: u.homeGame2,
          awayGame1: u.awayGame1,
          awayGame2: u.awayGame2,
        },
      })
    ),
    // Prisma Postgres is a remote connection with real round-trip latency;
    // the 2s/5s defaults for acquiring/running a transaction are too tight
    // for a multi-table batch update over it.
    { maxWait: 10_000, timeout: 20_000 }
  );
  revalidatePath(`/leagues/${leagueId}/matches/${matchId}`);
}
