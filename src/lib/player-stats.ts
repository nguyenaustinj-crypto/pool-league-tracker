import type { CardScores } from "@/lib/score-entry";

// A player's own season record, read straight off the score cards: no new
// tables, no new fields. Their score in a game is whatever the card recorded
// for their side -- 10 for a win, the balls they pocketed for a loss -- so
// the points total here is the same "point leaders" column the league keeps
// by hand on its results sheet.
//
// Pure, so it's unit-tested directly (player-stats.test.ts).

export interface PlayerPairing extends CardScores {
  /** Which match this card belongs to, for counting matches played. */
  matchId: string;
  homePlayerId: string;
  awayPlayerId: string;
}

export interface PlayerStats {
  matchesPlayed: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  /** The player's own points across every game they've played. */
  points: number;
  eros: number;
  /** Null until they've played a game, so the page can say so instead of "0%". */
  winPercent: number | null;
  pointsPerGame: number | null;
}

/** A match, round or game with nothing entered yet contributes nothing. */
function gameOf(pairing: PlayerPairing, side: "home" | "away", game: 1 | 2) {
  const home = game === 1 ? pairing.homeGame1 : pairing.homeGame2;
  const away = game === 1 ? pairing.awayGame1 : pairing.awayGame2;
  const homeEro = game === 1 ? pairing.homeGame1Ero : pairing.homeGame2Ero;
  const awayEro = game === 1 ? pairing.awayGame1Ero : pairing.awayGame2Ero;
  return side === "home"
    ? { mine: home, theirs: away, ero: homeEro }
    : { mine: away, theirs: home, ero: awayEro };
}

export function calculatePlayerStats(playerId: string, pairings: PlayerPairing[]): PlayerStats {
  const matches = new Set<string>();
  let gamesPlayed = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let points = 0;
  let eros = 0;

  for (const pairing of pairings) {
    const side =
      pairing.homePlayerId === playerId
        ? "home"
        : pairing.awayPlayerId === playerId
          ? "away"
          : null;
    if (!side) continue;

    for (const number of [1, 2] as const) {
      const { mine, theirs, ero } = gameOf(pairing, side, number);
      // A played game always has a winner on 10, so both sides on 0 means
      // nobody has entered it yet.
      if (mine === 0 && theirs === 0) continue;

      matches.add(pairing.matchId);
      gamesPlayed += 1;
      points += mine;
      if (ero) eros += 1;
      if (mine > theirs) gamesWon += 1;
      else if (theirs > mine) gamesLost += 1;
    }
  }

  // Forfeits score a handicap, so points can carry a decimal; round away the
  // float noise from adding them up.
  points = Math.round(points * 10) / 10;

  return {
    matchesPlayed: matches.size,
    gamesPlayed,
    gamesWon,
    gamesLost,
    points,
    eros,
    winPercent: gamesPlayed === 0 ? null : Math.round((gamesWon / gamesPlayed) * 100),
    pointsPerGame: gamesPlayed === 0 ? null : Math.round((points / gamesPlayed) * 10) / 10,
  };
}
