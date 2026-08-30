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
 * Round-robin pairing schedule for a 3-a-side round: across 3 rounds, each
 * home player faces each away player exactly once.
 * Round r (0-indexed): home[i] plays away[(i + r) % 3].
 * Verified against the real rotation used on the paper sheet.
 */
export function awayIndexForRound(homeIndex: number, roundIndex: number): number {
  return (homeIndex + roundIndex) % 3;
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

/**
 * UNCONFIRMED: the paper sheet has a "Bonus over 22" line for when a team's
 * handicap total exceeds the league's cap of 22, but every sample round we
 * had to check this against left that cell blank (either it never triggered,
 * or it was a hand-filled sheet and simply not filled in). We could not
 * verify what this bonus should be, so it currently contributes 0.
 *
 * If your league confirms the rule, encode it here -- everything else in
 * calculateRoundScore() below (score subtotals, and the handicap-difference
 * bonus) is verified exactly against real completed score sheets.
 */
function bonusOverCap(_teamHandicapTotal: number): number {
  return 0;
}

/**
 * Computes one round's score for both teams.
 *
 * Verified rule: the team with the LOWER handicap total gets a bonus equal
 * to the handicap difference between the two teams, doubled and rounded to
 * the nearest whole number, added to their score subtotal. This matched three
 * separate rounds' real numbers exactly (e.g. a 0.8 handicap gap produced a
 * +2 bonus in every round of that match).
 */
export function calculateRoundScore(
  pairings: PairingScore[],
  homeHandicapTotal: number,
  awayHandicapTotal: number
): RoundScore {
  const homeScoreSubtotal = pairings.reduce((sum, p) => sum + pairingHomeTotal(p), 0);
  const awayScoreSubtotal = pairings.reduce((sum, p) => sum + pairingAwayTotal(p), 0);

  const handicapDifference = Math.abs(homeHandicapTotal - awayHandicapTotal);
  const roundedBonus = Math.round(handicapDifference * 2);

  const homeIsUnderdog = homeHandicapTotal < awayHandicapTotal;
  const homeBonus = (homeIsUnderdog ? roundedBonus : 0) + bonusOverCap(homeHandicapTotal);
  const awayBonus = (!homeIsUnderdog ? roundedBonus : 0) + bonusOverCap(awayHandicapTotal);

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
