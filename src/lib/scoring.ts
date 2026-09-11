// Scoring math for a match, reverse-engineered from real filled-in copies of
// the paper "Bonus Score Sheet" and verified against three separate rounds of
// real numbers before being encoded here.

export interface PairingScore {
  homeGame1: number;
  homeGame2: number;
  awayGame1: number;
  awayGame2: number;
}

export function pairingHomeTotal(p: PairingScore): number {
  return p.homeGame1 + p.homeGame2;
}

export function pairingAwayTotal(p: PairingScore): number {
  return p.awayGame1 + p.awayGame2;
}

/**
 * Round-robin pairing schedule for an N-a-side round (N = number of
 * tables): across N rounds, each home player faces each away player
 * exactly once. Round r (0-indexed): home[i] plays away[(i + r) % N].
 * Verified against the real rotation used on the paper sheet, for the
 * N=3 case that sheet happened to use.
 */
export function awayIndexForRound(homeIndex: number, roundIndex: number, tableCount: number): number {
  return (homeIndex + roundIndex) % tableCount;
}

export interface RoundTeamScore {
  scoreSubtotal: number;
  handicapTotal: number;
  bonus: number;
  roundTotal: number;
}

export interface RoundScore {
  home: RoundTeamScore;
  away: RoundTeamScore;
}

export const HANDICAP_CAP = 22;

/** How far a side's summed handicap sits over the 22 cap (0 if at or under). */
export function amountOverCap(handicapTotal: number): number {
  // Handicaps are kept to one decimal, so round to a tenth to strip float
  // noise (e.g. 7.9 + 7.0 + 8.5 = 23.400000000000002) before comparing.
  return Math.max(0, Math.round((handicapTotal - HANDICAP_CAP) * 10) / 10);
}

/**
 * Computes one round's score for both teams.
 *
 * Handicap rule, as stated directly by the league (2026-09-10), which
 * supersedes the reading of the written rules this used before:
 *   1. Sum each side's player handicaps.
 *   2. Anything over 22 is that side's bonus amount.
 *   3. Take the difference between the two sides' over-22 amounts, times 2.
 *   4. The side with the lower over-22 amount gets that, rounded, added to
 *      its total. The other side gets nothing.
 *
 * So a side at or under 22 has an over-22 amount of 0, and if neither side
 * is over 22 there is no bonus at all.
 *
 * Verified against the real played paper sheet (23.4 vs 22.3): 1.4 and 0.3
 * over, difference 1.1, doubled 2.2, rounded 2 -- exactly the bonus that
 * sheet recorded. The previous formula gave 3 there.
 */
export function calculateRoundScore(
  pairings: PairingScore[],
  homeHandicapTotal: number,
  awayHandicapTotal: number
): RoundScore {
  const homeScoreSubtotal = pairings.reduce((sum, p) => sum + pairingHomeTotal(p), 0);
  const awayScoreSubtotal = pairings.reduce((sum, p) => sum + pairingAwayTotal(p), 0);

  const homeOver = amountOverCap(homeHandicapTotal);
  const awayOver = amountOverCap(awayHandicapTotal);
  const bonus = Math.round(Math.abs(homeOver - awayOver) * 2);

  const homeBonus = homeOver < awayOver ? bonus : 0;
  const awayBonus = awayOver < homeOver ? bonus : 0;

  return {
    home: {
      scoreSubtotal: homeScoreSubtotal,
      handicapTotal: homeHandicapTotal,
      bonus: homeBonus,
      roundTotal: homeScoreSubtotal + homeBonus,
    },
    away: {
      scoreSubtotal: awayScoreSubtotal,
      handicapTotal: awayHandicapTotal,
      bonus: awayBonus,
      roundTotal: awayScoreSubtotal + awayBonus,
    },
  };
}
