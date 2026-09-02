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

export async function createPlayer(leagueId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  await prisma.player.create({ data: { name, rating, leagueId } });
  revalidatePath(`/leagues/${leagueId}`);
}

export async function updatePlayer(leagueId: string, playerId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  await prisma.player.update({ where: { id: playerId }, data: { name, rating } });
  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/leagues/${leagueId}`);
}

export async function deletePlayer(leagueId: string, playerId: string) {
  const pairingCount = await prisma.pairing.count({
    where: { OR: [{ homePlayerId: playerId }, { awayPlayerId: playerId }] },
  });
  if (pairingCount > 0) {
    throw new Error(
      "This player is part of an existing match's lineup — remove them from that match first."
    );
  }

  await prisma.player.delete({ where: { id: playerId } });
  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/leagues/${leagueId}`);
}

async function validateLineup(leagueId: string, homePlayerIds: string[], awayPlayerIds: string[]) {
  const tableCount = homePlayerIds.length;
  if (tableCount === 0 || awayPlayerIds.length !== tableCount) {
    throw new Error("Pick one player per table for each side.");
  }
  const allIds = [...homePlayerIds, ...awayPlayerIds];
  if (new Set(allIds).size !== allIds.length) {
    throw new Error("Each player can only be picked for one table, on one side.");
  }
  const players = await prisma.player.findMany({ where: { id: { in: allIds } } });
  if (players.length !== allIds.length || players.some((p) => p.leagueId !== leagueId)) {
    throw new Error("All players must belong to this league.");
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
  const homeLabel = String(formData.get("homeLabel") ?? "").trim() || null;
  const awayLabel = String(formData.get("awayLabel") ?? "").trim() || null;
  const homePlayerIds = formData.getAll("homePlayerIds").map(String);
  const awayPlayerIds = formData.getAll("awayPlayerIds").map(String);

  await validateLineup(leagueId, homePlayerIds, awayPlayerIds);

  const match = await prisma.match.create({
    data: {
      leagueId,
      homeLabel,
      awayLabel,
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
  const homeLabel = String(formData.get("homeLabel") ?? "").trim() || null;
  const awayLabel = String(formData.get("awayLabel") ?? "").trim() || null;
  const homePlayerIds = formData.getAll("homePlayerIds").map(String);
  const awayPlayerIds = formData.getAll("awayPlayerIds").map(String);

  await validateLineup(leagueId, homePlayerIds, awayPlayerIds);

  // The edit form always submits a full lineup (pre-checked with the
  // current one), so only regenerate Rounds/Pairings -- wiping any scores
  // entered so far -- if the lineup actually changed from what's saved.
  const currentRound = await prisma.round.findFirst({
    where: { matchId, roundNumber: 1 },
    include: { pairings: true },
  });
  const currentHomeIds = currentRound?.pairings.map((p) => p.homePlayerId) ?? [];
  const currentAwayIds = currentRound?.pairings.map((p) => p.awayPlayerId) ?? [];
  const lineupChanged =
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
      homeLabel,
      awayLabel,
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
    )
  );
  revalidatePath(`/leagues/${leagueId}/matches/${matchId}`);
}
