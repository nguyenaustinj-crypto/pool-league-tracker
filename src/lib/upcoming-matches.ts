import { canConfirmCard, type CardStatus } from "@/lib/score-entry";
import { isRoundPlayed, type PairingScore } from "@/lib/scoring";

// What the home page puts under "Coming up": the matches in your leagues
// that still have something left to do. A match is on the list while it's
// scheduled for today or later, and stays there afterwards only while its
// scores aren't all in, or a card is waiting on you to confirm it. A locked
// match is finished by definition, so it never shows.
//
// Pure, so it's unit-tested directly (upcoming-matches.test.ts).

export interface UpcomingPairing extends PairingScore {
  tableNumber: number;
  homePlayerId: string;
  awayPlayerId: string;
  /** The accounts behind those two roster names, for who can confirm the card. */
  homeUserId: string | null;
  awayUserId: string | null;
  status: CardStatus;
  enteredById: string | null;
}

export interface UpcomingMatch {
  date: Date;
  lockedAt: Date | null;
  rounds: { roundNumber: number; pairings: UpcomingPairing[] }[];
}

export interface MatchAhead {
  /** Whether the viewer's own roster name is in this match's lineup. */
  playing: boolean;
  /** Their table on the sheet (from round 1, where table i is lineup spot i). */
  tableNumber: number | null;
  /** Rounds with no scores entered yet. */
  roundsToPlay: number;
  /** Cards this viewer is the one who can confirm. */
  cardsToConfirm: number;
  /** Whether anyone has entered a score yet. */
  started: boolean;
  /** Whether it's still to come, rather than a match whose scores are late. */
  scheduledAhead: boolean;
}

/** How long a match with scores still missing keeps showing on the home page. */
export const STALE_AFTER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Midnight UTC on the given day. Match dates picked in a form are stored as
 * UTC midnight, so days are compared in UTC too.
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** The oldest match date the home page still lists; also the database query's cutoff. */
export function homePageCutoff(now: Date, staleAfterDays: number = STALE_AFTER_DAYS): Date {
  return new Date(startOfUtcDay(now).getTime() - staleAfterDays * DAY_MS);
}

export function matchAhead(
  match: UpcomingMatch,
  {
    playerId,
    userId,
    isManager,
    now,
    staleAfterDays = STALE_AFTER_DAYS,
  }: {
    /** The viewer's roster name in that league, if they've picked one. */
    playerId: string | null;
    userId: string | null;
    isManager: boolean;
    now: Date;
    staleAfterDays?: number;
  }
): MatchAhead | null {
  // A locked match is done: managers reopen it from the match page.
  if (match.lockedAt) return null;

  const pairings = match.rounds.flatMap((round) => round.pairings);
  const playing =
    playerId !== null &&
    pairings.some((p) => p.homePlayerId === playerId || p.awayPlayerId === playerId);
  const firstRound = match.rounds.find((round) => round.roundNumber === 1);
  const myCard = firstRound?.pairings.find(
    (p) => p.homePlayerId === playerId || p.awayPlayerId === playerId
  );

  const roundsToPlay = match.rounds.filter((round) => !isRoundPlayed(round.pairings)).length;
  const cardsToConfirm = pairings.filter((p) =>
    canConfirmCard({
      isManager,
      viewerUserId: userId,
      homeUserId: p.homeUserId,
      awayUserId: p.awayUserId,
      // Locked matches returned above, so this card is editable.
      locked: false,
      status: p.status,
      enteredById: p.enteredById,
    })
  ).length;

  const dayStart = startOfUtcDay(now).getTime();
  const scheduledAhead = match.date.getTime() >= dayStart;
  const tooOld = match.date.getTime() < dayStart - staleAfterDays * DAY_MS;
  // Once it's in the past, it belongs on the home page only while it's
  // unfinished -- otherwise every played match would pile up there.
  if (!scheduledAhead && (tooOld || (roundsToPlay === 0 && cardsToConfirm === 0))) return null;

  return {
    playing,
    tableNumber: myCard?.tableNumber ?? null,
    roundsToPlay,
    cardsToConfirm,
    started: match.rounds.some((round) => isRoundPlayed(round.pairings)),
    scheduledAhead,
  };
}
