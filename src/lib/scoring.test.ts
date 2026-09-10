import { describe, it, expect } from "vitest";
import {
  awayIndexForRound,
  calculateRoundScore,
  pairingHomeTotal,
  pairingAwayTotal,
  HANDICAP_CAP,
  type PairingScore,
} from "@/lib/scoring";

/**
 * These tests exist because the scoring math is the whole product, it was
 * reverse-engineered by hand from a paper score sheet, and it has already
 * changed twice (generalized from a fixed 3-a-side to N tables, then the
 * "bonus over 22" rule). A wrong score is silent -- nobody notices until
 * the season standings are wrong -- so the real numbers from the source
 * documents are pinned here rather than left to memory.
 *
 * Sources:
 *  - the filled-in paper sheet in `Billardscoresheet-*` (a real played match)
 *  - the league's written rules, Rev 1.6 (see `docs/league-rules/`)
 */

function pairing(homeG1: number, homeG2: number, awayG1: number, awayG2: number): PairingScore {
  return { homeGame1: homeG1, homeGame2: homeG2, awayGame1: awayG1, awayGame2: awayG2 };
}

describe("pairing totals", () => {
  it("sums both games for each side", () => {
    const p = pairing(6, 10, 10, 4);
    expect(pairingHomeTotal(p)).toBe(16);
    expect(pairingAwayTotal(p)).toBe(14);
  });
});

describe("round-robin rotation (awayIndexForRound)", () => {
  // The paper sheet's own 3-a-side rotation: across 3 rounds, home[i] faces
  // away[(i + r) % 3]. Round 1 pairs table i's two picks directly.
  it("pairs table i's own two picks in round 1", () => {
    for (const tableCount of [1, 2, 3, 4, 5, 6]) {
      for (let i = 0; i < tableCount; i++) {
        expect(awayIndexForRound(i, 0, tableCount)).toBe(i);
      }
    }
  });

  it("has every home player face every away player exactly once, for any table count", () => {
    for (const tableCount of [1, 2, 3, 4, 5, 6]) {
      for (let homeIndex = 0; homeIndex < tableCount; homeIndex++) {
        const opponents = Array.from({ length: tableCount }, (_, round) =>
          awayIndexForRound(homeIndex, round, tableCount)
        );
        expect([...new Set(opponents)].sort()).toEqual(
          Array.from({ length: tableCount }, (_, i) => i)
        );
      }
    }
  });

  it("gives every away player exactly one opponent per round (no double-booking)", () => {
    for (const tableCount of [2, 3, 4, 5, 6]) {
      for (let round = 0; round < tableCount; round++) {
        const awayInThisRound = Array.from({ length: tableCount }, (_, homeIndex) =>
          awayIndexForRound(homeIndex, round, tableCount)
        );
        expect(new Set(awayInThisRound).size).toBe(tableCount);
      }
    }
  });
});

describe("calculateRoundScore -- score subtotals", () => {
  it("sums every pairing's games into each side's subtotal", () => {
    // The real sheet's round 1: JR 6+10, TOMMY 7+10, JAMEY 10+10 = 53
    // against JOHN 10+4, ANDY 10+4, SATCH 4+6 = 38.
    const pairings = [pairing(6, 10, 10, 4), pairing(7, 10, 10, 4), pairing(10, 10, 4, 6)];
    const score = calculateRoundScore(pairings, 23.4, 22.3);
    expect(score.home.scoreSubtotal).toBe(53);
    expect(score.away.scoreSubtotal).toBe(38);
  });

  it("handles an empty round without blowing up", () => {
    const score = calculateRoundScore([], 0, 0);
    expect(score.home.scoreSubtotal).toBe(0);
    expect(score.away.scoreSubtotal).toBe(0);
  });
});

describe("calculateRoundScore -- handicap bonus, neither team over the cap", () => {
  it("gives the lower-handicap team the doubled difference, rounded", () => {
    // 21.0 vs 20.0 -> difference 1.0, doubled = 2. Nothing over the 22 cap.
    const score = calculateRoundScore([], 21.0, 20.0);
    expect(score.away.bonus).toBe(2);
    expect(score.home.bonus).toBe(0);
  });

  it("gives the bonus to the home side when home is the underdog", () => {
    const score = calculateRoundScore([], 20.0, 21.0);
    expect(score.home.bonus).toBe(2);
    expect(score.away.bonus).toBe(0);
  });

  it("gives no bonus at all when the handicaps are level", () => {
    const score = calculateRoundScore([], 20.0, 20.0);
    expect(score.home.bonus).toBe(0);
    expect(score.away.bonus).toBe(0);
  });

  it("rounds the doubled difference to a whole number", () => {
    // 0.8 gap -> 1.6 -> 2. This is the gap from the real sheet's teams and
    // it produced a +2 bonus in every round of that match.
    const score = calculateRoundScore([], 21.8, 21.0);
    expect(score.away.bonus).toBe(2);
  });
});

describe("calculateRoundScore -- bonus over the 22 cap", () => {
  it("reproduces the league rules' own worked example", () => {
    // Rules Rev 1.6, rule #2: totals 23.2 and 24.7 (both over 22).
    // Base handicap = 1.5 difference doubled = 3.0.
    // Bonus handicap = 1.5 ("if both exceed 22, use the difference").
    // 3.0 + 1.5 = 4.5, rounded once = 5, all to the lower-handicap team.
    const score = calculateRoundScore([], 23.2, 24.7);
    expect(score.home.bonus).toBe(5);
    expect(score.away.bonus).toBe(0);
  });

  it("rounds base and cap bonus together, not separately", () => {
    // The rule adds the two figures and rounds once ("...for a total
    // handicap of 4.5 then rounded"). 22.1 vs 22.3 is a case where that
    // actually matters: base 0.4 + cap bonus 0.2 = 0.6, which rounds to 1,
    // whereas rounding each piece first would give 0 + 0 = 0.
    const score = calculateRoundScore([], 22.3, 22.1);
    expect(score.away.bonus).toBe(1);
  });

  it("adds only the over-cap excess when a single team is over the cap", () => {
    // Extrapolated branch: the rules' example only covers both-teams-over.
    // 25.0 vs 20.0 -> base 10.0, plus 25.0's 3.0 excess over 22 = 13.
    const score = calculateRoundScore([], 25.0, 20.0);
    expect(score.away.bonus).toBe(13);
    expect(score.home.bonus).toBe(0);
  });

  it("treats a total exactly at the cap as not over it", () => {
    // 22.0 is not "over 22", so this is a plain base-handicap case:
    // difference 2.0 doubled = 4, with no cap bonus stacked on.
    const score = calculateRoundScore([], 22.0, 20.0);
    expect(score.away.bonus).toBe(4);
  });

  it("exposes the cap as a constant so the UI and math agree", () => {
    expect(HANDICAP_CAP).toBe(22);
  });
});

describe("calculateRoundScore -- the real paper sheet", () => {
  const realRound = [pairing(6, 10, 10, 4), pairing(7, 10, 10, 4), pairing(10, 10, 4, 6)];
  const homeHandicap = 23.4; // JR 7.9 + TOMMY 7.0 + JAMEY 8.5
  const awayHandicap = 22.3; // JOHN 8.0 + ANDY 6.9 + SATCH 7.4

  it("matches the sheet's recorded score subtotals and unbonused home total", () => {
    const score = calculateRoundScore(realRound, homeHandicap, awayHandicap);
    expect(score.home.scoreSubtotal).toBe(53);
    expect(score.away.scoreSubtotal).toBe(38);
    // The stronger side gets no bonus, so its round total is its subtotal --
    // the sheet recorded exactly 53.
    expect(score.home.roundTotal).toBe(53);
  });

  it("DOCUMENTED DISCREPANCY: rules give the away side +3, the sheet recorded +2", () => {
    // Both totals are over 22 (23.4 and 22.3), so per the written rules:
    // base 1.1 doubled = 2.2, plus a 1.1 cap bonus = 3.3, rounded to 3.
    // The real hand-filled sheet recorded a bonus of 2 and left its "Bonus
    // over 22" cell blank -- so either the scorekeeper skipped that line, or
    // real play doesn't apply it as literally as the written rules do.
    //
    // This test pins CURRENT behavior (the written rule) rather than the
    // sheet. If the league confirms the sheet is right, change the formula
    // and this expectation together -- don't "fix" one without the other.
    const score = calculateRoundScore(realRound, homeHandicap, awayHandicap);
    expect(score.away.bonus).toBe(3);
    expect(score.away.roundTotal).toBe(41);

    const sheetRecordedBonus = 2;
    expect(score.away.bonus).not.toBe(sheetRecordedBonus);
  });
});

describe("calculateRoundScore -- round totals", () => {
  it("is score subtotal plus that side's bonus", () => {
    const pairings = [pairing(10, 10, 1, 2)];
    const score = calculateRoundScore(pairings, 25.0, 20.0);
    expect(score.home.roundTotal).toBe(score.home.scoreSubtotal + score.home.bonus);
    expect(score.away.roundTotal).toBe(score.away.scoreSubtotal + score.away.bonus);
  });

  it("reports each side's handicap total back unchanged", () => {
    const score = calculateRoundScore([], 23.4, 22.3);
    expect(score.home.handicapTotal).toBe(23.4);
    expect(score.away.handicapTotal).toBe(22.3);
  });
});
