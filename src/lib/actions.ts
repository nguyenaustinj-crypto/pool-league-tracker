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

export async function createPlayer(leagueId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  await prisma.player.create({ data: { name, rating, leagueId } });
  revalidatePath(`/leagues/${leagueId}`);
}

export async function createMatch(leagueId: string, formData: FormData) {
  const homeLabel = String(formData.get("homeLabel") ?? "").trim() || null;
  const awayLabel = String(formData.get("awayLabel") ?? "").trim() || null;
  const homePlayerIds = formData.getAll("homePlayerIds").map(String);
  const awayPlayerIds = formData.getAll("awayPlayerIds").map(String);

  if (homePlayerIds.length !== 3 || awayPlayerIds.length !== 3) {
    throw new Error("Pick exactly 3 players for each side.");
  }
  if (homePlayerIds.some((id) => awayPlayerIds.includes(id))) {
    throw new Error("A player can't be on both sides of the same match.");
  }

  const players = await prisma.player.findMany({
    where: { id: { in: [...homePlayerIds, ...awayPlayerIds] } },
  });
  if (players.length !== 6 || players.some((p) => p.leagueId !== leagueId)) {
    throw new Error("All 6 players must belong to this league.");
  }

  const match = await prisma.match.create({
    data: {
      leagueId,
      homeLabel,
      awayLabel,
      rounds: {
        create: [0, 1, 2].map((roundIndex) => ({
          roundNumber: roundIndex + 1,
          pairings: {
            create: homePlayerIds.map((homePlayerId, homeIndex) => ({
              homePlayerId,
              awayPlayerId: awayPlayerIds[awayIndexForRound(homeIndex, roundIndex)],
            })),
          },
        })),
      },
    },
  });

  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/leagues/${leagueId}/matches/${match.id}`);
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
