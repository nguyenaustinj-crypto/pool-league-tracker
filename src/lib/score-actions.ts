"use server";

import { revalidatePath } from "next/cache";
import { getLeagueAccess, requireLeagueManager } from "@/lib/access";
import { redirectToLogin } from "@/lib/editor";
import { prisma } from "@/lib/prisma";
import {
  canConfirmCard,
  canEditCard,
  cardScoresOf,
  gamesToScores,
  parseCardInput,
  statusAfterSave,
  validateGame,
} from "@/lib/score-entry";

// Entering scores one card (one table in one round) at a time. The two
// players at a table can enter and confirm it; managers can change any card.
// Every check happens here on the server: server actions accept direct POST
// requests, and the score input comes from the browser.
//
// Each save carries the card's version number. If someone else saved the
// card in the meantime, the save is refused rather than overwriting them.

export type CardActionResult =
  | { ok: true }
  // stale: someone else saved the card first; the page now shows their version.
  | { ok: false; message: string; stale?: boolean };

const STALE =
  "Someone else just updated this card, so your change wasn't saved. It now shows their version.";

async function loadCard(leagueId: string, matchId: string, pairingId: string) {
  const card = await prisma.pairing.findUnique({
    where: { id: pairingId },
    include: { round: { include: { match: true } }, homePlayer: true, awayPlayer: true },
  });
  if (!card || card.round.matchId !== matchId || card.round.match.leagueId !== leagueId) {
    throw new Error("That score card isn't in this match.");
  }
  return card;
}

function revalidateMatch(leagueId: string, matchId: string) {
  // The home page shows what's still to play and each player's own record,
  // both of which move as soon as a card is saved.
  revalidatePath("/");
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/matches`);
  revalidatePath(`/leagues/${leagueId}/matches/${matchId}`);
}

export async function saveScoreCard(
  leagueId: string,
  matchId: string,
  pairingId: string,
  rawInput: unknown
): Promise<CardActionResult> {
  const access = await getLeagueAccess(leagueId);
  if (!access.user && !access.isSiteAdmin) return redirectToLogin();

  const input = parseCardInput(rawInput);
  if (!input) return { ok: false, message: "Those scores didn't come through. Please try again." };

  const card = await loadCard(leagueId, matchId, pairingId);
  const locked = card.round.match.lockedAt !== null;
  const viewerUserId = access.user?.id ?? null;
  if (
    !canEditCard({
      isManager: access.canManage,
      viewerUserId,
      homeUserId: card.homePlayer.userId,
      awayUserId: card.awayPlayer.userId,
      locked,
    })
  ) {
    return {
      ok: false,
      message: locked
        ? "This match is locked. Ask a league manager to change it."
        : "Only the two players at this table, or a league manager, can enter its scores.",
    };
  }

  for (const game of input.games) {
    const loser = game.winner === "home" ? card.awayPlayer : card.homePlayer;
    const problem = validateGame(game, { loserHandicap: loser.rating, isManager: access.canManage });
    if (problem) return { ok: false, message: problem };
  }

  const after = gamesToScores(input.games[0], input.games[1]);
  const status = statusAfterSave(access.canManage);
  const saved = await prisma.$transaction(
    async (tx) => {
      const updated = await tx.pairing.updateMany({
        where: { id: pairingId, version: input.version },
        data: {
          ...after,
          status,
          enteredById: viewerUserId,
          confirmedById: status === "CONFIRMED" ? viewerUserId : null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return false;
      await tx.scoreEdit.create({
        data: {
          pairingId,
          userId: viewerUserId,
          before: cardScoresOf(card),
          after,
          note: input.games.some((g) => g.forfeit) ? "forfeit" : null,
        },
      });
      return true;
    },
    // Prisma Postgres is remote; the default transaction timeouts are tight.
    { maxWait: 10_000, timeout: 20_000 }
  );

  revalidateMatch(leagueId, matchId);
  return saved ? { ok: true } : { ok: false, message: STALE, stale: true };
}

export async function confirmScoreCard(
  leagueId: string,
  matchId: string,
  pairingId: string,
  version: number
): Promise<CardActionResult> {
  const access = await getLeagueAccess(leagueId);
  if (!access.user && !access.isSiteAdmin) return redirectToLogin();
  if (!Number.isInteger(version)) return { ok: false, message: STALE, stale: true };

  const card = await loadCard(leagueId, matchId, pairingId);
  const viewerUserId = access.user?.id ?? null;
  if (
    !canConfirmCard({
      isManager: access.canManage,
      viewerUserId,
      homeUserId: card.homePlayer.userId,
      awayUserId: card.awayPlayer.userId,
      locked: card.round.match.lockedAt !== null,
      status: card.status,
      enteredById: card.enteredById,
    })
  ) {
    return {
      ok: false,
      message: "Only the other player at this table, or a league manager, can confirm it.",
    };
  }

  const confirmed = await prisma.$transaction(
    async (tx) => {
      const updated = await tx.pairing.updateMany({
        where: { id: pairingId, version, status: "ENTERED" },
        data: { status: "CONFIRMED", confirmedById: viewerUserId, version: { increment: 1 } },
      });
      if (updated.count !== 1) return false;
      const scores = cardScoresOf(card);
      await tx.scoreEdit.create({
        data: { pairingId, userId: viewerUserId, before: scores, after: scores, note: "confirmed" },
      });
      return true;
    },
    { maxWait: 10_000, timeout: 20_000 }
  );

  revalidateMatch(leagueId, matchId);
  return confirmed ? { ok: true } : { ok: false, message: STALE, stale: true };
}

/**
 * Sets each player's handicap for this match, at the start of it. Managers
 * only. Also updates their roster handicap, so it's the starting point for
 * the next match; matches already played keep the handicaps they were
 * scored with.
 */
export async function setMatchHandicaps(leagueId: string, matchId: string, formData: FormData) {
  await requireLeagueManager(leagueId);
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { leagueId: true, lockedAt: true },
  });
  if (!match || match.leagueId !== leagueId) throw new Error("That match isn't in this league.");
  if (match.lockedAt) throw new Error("This match is locked. Unlock it to change handicaps.");

  // Only the players actually in this match, whatever the form says.
  const cards = await prisma.pairing.findMany({
    where: { round: { matchId } },
    select: { homePlayerId: true, awayPlayerId: true },
  });
  const inMatch = new Set(cards.flatMap((c) => [c.homePlayerId, c.awayPlayerId]));

  const updates: { playerId: string; handicap: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("handicap_")) continue;
    const playerId = key.slice("handicap_".length);
    if (!inMatch.has(playerId)) throw new Error("That player isn't in this match.");
    const handicap = Number(value);
    if (!Number.isFinite(handicap) || handicap < 0 || handicap > 20) {
      throw new Error("Handicaps are between 0 and 20.");
    }
    updates.push({ playerId, handicap: Math.round(handicap * 10) / 10 });
  }
  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.flatMap((u) => [
      prisma.pairing.updateMany({
        where: { round: { matchId }, homePlayerId: u.playerId },
        data: { homeHandicap: u.handicap },
      }),
      prisma.pairing.updateMany({
        where: { round: { matchId }, awayPlayerId: u.playerId },
        data: { awayHandicap: u.handicap },
      }),
      prisma.player.update({ where: { id: u.playerId }, data: { rating: u.handicap } }),
    ]),
    { maxWait: 10_000, timeout: 20_000 }
  );
  revalidateMatch(leagueId, matchId);
}

/** Locking a finished match leaves its scores to managers only. */
export async function setMatchLock(leagueId: string, matchId: string, locked: boolean) {
  const access = await requireLeagueManager(leagueId);
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.leagueId !== leagueId) throw new Error("That match isn't in this league.");

  await prisma.match.update({
    where: { id: matchId },
    data: locked
      ? { lockedAt: new Date(), lockedById: access.user?.id ?? null }
      : { lockedAt: null, lockedById: null },
  });
  revalidateMatch(leagueId, matchId);
}
