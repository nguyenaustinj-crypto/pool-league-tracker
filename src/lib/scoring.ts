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

/**
 * CONFIRMED (2026-09-02) from the league's own written rules (Rev 1.6, rule
 * #2 -- see docs/league-rules/). Quoting it closely:
 *
 *   "Bonus handicap applies when a team handicap is over 22. If both team
 *   handicaps exceed 22, use the [raw] difference [as the bonus amount]...
 *   Each point over 22 will be a direct add to the base handicap."
 *
 * Verified against the rule's own worked example: totals 23.2 and 24.7
 * (both over 22) give a base handicap of 3.0 (their 1.5 difference, doubled
 * -- the pre-existing formula below) plus a bonus handicap of 1.5 (since
 * both teams exceed 22, "use the difference" -- the same 1.5), for a
 * combined 4.5, which rounds to a final 5. This function reproduces that
 * 1.5 bonus-handicap figure exactly for that case.
 *
 * CAVEAT: applying this to the one real completed match sheet this app was
 * originally verified against (23.4 vs 22.3 -- both actually exceed 22)
 * gives a bonus of 3, but that real sheet's own hand-computed total shows a
 * bonus of 2 (its "Bonus over 22" cell was left blank/0). That could mean
 * the scorekeeper simply didn't apply this line in practice, or that real
 * play doesn't follow the written rule as literally as this does -- worth
 * confirming with the league before leaning on this near the 22 cap.
 *
 * The one case the rule's example doesn't cover is when only ONE team is
 * over the cap. There, this uses that team's excess over 22 directly (the
 * "each point over 22 is a direct add" line), but that specific branch
 * isn't independently checked against a worked example the way the
 * both-over-22 case above is.
 */
function bonusOverCap(lowerHandicapTotal: number, higherHandicapTotal: number, rawDifference: number): number {
  const lowerOver = Math.max(0, lowerHandicapTotal - HANDICAP_CAP);
  const higherOver = Math.max(0, higherHandicapTotal - HANDICAP_CAP);

  if (lowerOver === 0 && higherOver === 0) return 0;
  if (lowerOver > 0 && higherOver > 0) return rawDifference;
  return Math.max(lowerOver, higherOver);
}

/**
 * Computes one round's score for both teams.
 *
 * Verified rule: the team with the LOWER handicap total gets a bonus added
 * to their score subtotal, equal to the handicap difference between the two
 * teams doubled ("base handicap"), plus the bonus-over-22 amount above when
 * applicable, with the *combined* total rounded once to the nearest whole
 * number (not each piece rounded separately -- see the rule's own worked
 * example, which rounds 4.5 as one figure, not 3.0 and 1.5 independently).
 * The base-handicap-only case (no cap involved) matched three separate real
 * rounds' numbers exactly (e.g. a 0.8 handicap gap produced a +2 bonus in
 * every round of that match).
 */
export function calculateRoundScore(
  pairings: PairingScore[],
  homeHandicapTotal: number,
  awayHandicapTotal: number
): RoundScore {
  const homeScoreSubtotal = pairings.reduce((sum, p) => sum + pairingHomeTotal(p), 0);
  const awayScoreSubtotal = pairings.reduce((sum, p) => sum + pairingAwayTotal(p), 0);

  const rawDifference = Math.abs(homeHandicapTotal - awayHandicapTotal);
  const baseHandicap = rawDifference * 2;
  const lowerTotal = Math.min(homeHandicapTotal, awayHandicapTotal);
  const higherTotal = Math.max(homeHandicapTotal, awayHandicapTotal);
  const capBonus = bonusOverCap(lowerTotal, higherTotal, rawDifference);
  const combinedBonus = Math.round(baseHandicap + capBonus);

  const homeIsUnderdog = homeHandicapTotal < awayHandicapTotal;
  const homeBonus = homeIsUnderdog ? combinedBonus : 0;
  const awayBonus = !homeIsUnderdog ? combinedBonus : 0;

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
