"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { awayIndexForRound } from "@/lib/scoring";

export async function createTeam(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.team.create({ data: { name } });
  revalidatePath("/teams");
}

export async function createPlayer(teamId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rating = Number(formData.get("rating"));
  if (!name || Number.isNaN(rating)) return;

  await prisma.player.create({ data: { name, rating, teamId } });
  revalidatePath(`/teams/${teamId}`);
}

export async function createMatch(formData: FormData) {
  const homeTeamId = String(formData.get("homeTeamId") ?? "");
  const awayTeamId = String(formData.get("awayTeamId") ?? "");
  const homePlayerIds = formData.getAll("homePlayerIds").map(String);
  const awayPlayerIds = formData.getAll("awayPlayerIds").map(String);

  if (
    !homeTeamId ||
    !awayTeamId ||
    homeTeamId === awayTeamId ||
    homePlayerIds.length !== 3 ||
    awayPlayerIds.length !== 3
  ) {
    throw new Error("A match needs two different teams with exactly 3 players each.");
  }

  const match = await prisma.match.create({
    data: {
      homeTeamId,
      awayTeamId,
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

  revalidatePath("/");
  redirect(`/matches/${match.id}`);
}

export interface PairingScoreUpdate {
  pairingId: string;
  homeGame1: number;
  homeGame2: number;
  awayGame1: number;
  awayGame2: number;
}

export async function saveMatchScores(matchId: string, updates: PairingScoreUpdate[]) {
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
  revalidatePath(`/matches/${matchId}`);
}
