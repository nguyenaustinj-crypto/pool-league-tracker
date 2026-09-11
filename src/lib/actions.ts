"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/editor";
import { awayIndexForRound, type PairingScore } from "@/lib/scoring";

export async function createLeague(formData: FormData) {
  await requireEditor();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.league.create({ data: { name } });
  revalidatePath("/");
}

export async function updateLeague(leagueId: string, formData: FormData) {
  await requireEditor();

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
  await requireEditor();

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
  await requireEditor();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.team.create({ data: { name, leagueId } });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/teams`);
}

export async function updateTeam(leagueId: string, teamId: string, formData: FormData) {
  await requireEditor();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.team.update({ where: { id: teamId }, data: { name } });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/teams`);
  revalidatePath(`/leagues/${leagueId}/teams/${teamId}`);
  redirect(`/leagues/${leagueId}/teams/${teamId}`);
}

export async function deleteTeam(leagueId: string, teamId: string) {
  await requireEditor();

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
  await requireEditor();

  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  await prisma.player.create({ data: { name, rating, teamId } });
  revalidatePath(`/leagues/${leagueId}/teams`);
  revalidatePath(`/leagues/${leagueId}/teams/${teamId}`);
}

export async function updatePlayer(leagueId: string, playerId: string, formData: FormData) {
  await requireEditor();

  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  const player = await prisma.player.update({ where: { id: playerId }, data: { name, rating } });
  revalidatePath(`/leagues/${leagueId}/teams/${player.teamId}`);
  redirect(`/leagues/${leagueId}/teams/${player.teamId}`);
}

export async function deletePlayer(leagueId: string, playerId: string) {
  await requireEditor();

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

// Keyed by `${roundNumber}:${homePlayerId}:${awayPlayerId}` so a table-count
// or lineup change on a match that already has scores can carry forward the
// scores for any pairing that lands in the same spot again, instead of
// wiping the whole match. Round 1 pairings (home[i] vs away[i]) are always
// stable across a table-count change; later rounds are stable only where the
// round-robin rotation happens to still line up.
type PreservedScores = Map<string, PairingScore>;

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
  await requireEditor();

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
  await requireEditor();

  const dateValue = String(formData.get("date") ?? "");
  const homeTeamId = String(formData.get("homeTeamId") ?? "");
  const awayTeamId = String(formData.get("awayTeamId") ?? "");
  const homePlayerIds = formData.getAll("homePlayerIds").map(String);
  const awayPlayerIds = formData.getAll("awayPlayerIds").map(String);

  await validateLineup(leagueId, homeTeamId, awayTeamId, homePlayerIds, awayPlayerIds);

  const currentMatch = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });

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
          homeGame1: pairing.homeGame1,
          homeGame2: pairing.homeGame2,
          awayGame1: pairing.awayGame1,
          awayGame2: pairing.awayGame2,
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
  await requireEditor();

  await prisma.match.delete({ where: { id: matchId } });
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  redirect(`/leagues/${leagueId}/matches`);
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
  await requireEditor();

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
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  revalidatePath(`/leagues/${leagueId}/matches/${matchId}`);
}
