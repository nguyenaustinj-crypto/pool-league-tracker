import { describe, it, expect } from "vitest";
import {
  amountOverCap,
  awayIndexForRound,
  calculateRoundScore,
  isRoundPlayed,
  pairingHomeTotal,
  pairingAwayTotal,
  HANDICAP_CAP,
  type PairingScore,
} from "@/lib/scoring";

/**
 * These tests exist because the scoring math is the whole product, it was
 * reverse-engineered by hand from a paper score sheet, and it has already
 * changed several times. A wrong score is silent -- nobody notices until
 * the season standings are wrong -- so the real numbers are pinned here
 * rather than left to memory.
 *
 * Sources:
 *  - the filled-in paper sheet in `Billardscoresheet-*` (a real played match)
 *  - the handicap rule as stated directly by the league (2026-09-10)
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

describe("isRoundPlayed", () => {
  it("is false until someone enters a score", () => {
    expect(isRoundPlayed([])).toBe(false);
    expect(isRoundPlayed([pairing(0, 0, 0, 0), pairing(0, 0, 0, 0)])).toBe(false);
  });

  it("is true as soon as any game in the round has points", () => {
    expect(isRoundPlayed([pairing(0, 0, 0, 0), pairing(0, 0, 3, 0)])).toBe(true);
    expect(isRoundPlayed([pairing(10, 0, 0, 0)])).toBe(true);
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

describe("amountOverCap", () => {
  it("is how far a summed handicap sits over 22", () => {
    expect(amountOverCap(23.4)).toBe(1.4);
    expect(amountOverCap(24.7)).toBe(2.7);
  });

  it("is zero at or under 22, never negative", () => {
    expect(amountOverCap(22)).toBe(0);
    expect(amountOverCap(20)).toBe(0);
    expect(amountOverCap(0)).toBe(0);
  });

  it("strips floating-point noise from summed handicaps", () => {
    // JR 7.9 + TOMMY 7.0 + JAMEY 8.5 is 23.400000000000002 in floating point.
    expect(amountOverCap(7.9 + 7.0 + 8.5)).toBe(1.4);
  });

  it("exposes the cap as a constant so the UI and math agree", () => {
    expect(HANDICAP_CAP).toBe(22);
  });
});

describe("calculateRoundScore -- handicap bonus", () => {
  // The league's rule: sum each side's handicaps, take the amount each is
  // over 22, take the difference of those amounts times 2, and give it
  // (rounded) to the side with the lower over-22 amount.

  it("gives no bonus when neither side is over 22, however far apart they are", () => {
    const score = calculateRoundScore([], 21.0, 15.0);
    expect(score.home.bonus).toBe(0);
    expect(score.away.bonus).toBe(0);
  });

  it("gives no bonus when both sides are the same amount over 22", () => {
    const score = calculateRoundScore([], 23.5, 23.5);
    expect(score.home.bonus).toBe(0);
    expect(score.away.bonus).toBe(0);
  });

  it("treats a total of exactly 22 as not over", () => {
    const score = calculateRoundScore([], 22.0, 20.0);
    expect(score.home.bonus).toBe(0);
    expect(score.away.bonus).toBe(0);
  });

  it("doubles the difference in over-22 amounts when both sides are over", () => {
    // 24.7 and 23.2 are 2.7 and 1.2 over. Difference 1.5, doubled 3.
    // (The written rules' own worked example used these totals and got 5;
    // the rule the league stated directly gives 3, and that's what counts.)
    const score = calculateRoundScore([], 23.2, 24.7);
    expect(score.home.bonus).toBe(3);
    expect(score.away.bonus).toBe(0);
  });

  it("counts a side at or under 22 as zero over when only the other side is over", () => {
    // 25.0 is 3.0 over; 20.0 is 0 over. Difference 3.0, doubled 6.
    const score = calculateRoundScore([], 25.0, 20.0);
    expect(score.away.bonus).toBe(6);
    expect(score.home.bonus).toBe(0);
  });

  it("gives the bonus to whichever side has the lower over-22 amount, home or away", () => {
    const homeLower = calculateRoundScore([], 22.3, 23.4);
    expect(homeLower.home.bonus).toBe(2);
    expect(homeLower.away.bonus).toBe(0);

    const awayLower = calculateRoundScore([], 23.4, 22.3);
    expect(awayLower.away.bonus).toBe(2);
    expect(awayLower.home.bonus).toBe(0);
  });

  it("rounds the doubled difference to the nearest whole number", () => {
    // 0.5 and 0.2 over -> 0.3 -> 0.6 -> 1.
    expect(calculateRoundScore([], 22.5, 22.2).away.bonus).toBe(1);
    // 0.4 and 0.2 over -> 0.2 -> 0.4 -> 0.
    expect(calculateRoundScore([], 22.4, 22.2).away.bonus).toBe(0);
  });
});

describe("calculateRoundScore -- the real paper sheet", () => {
  const realRound = [pairing(6, 10, 10, 4), pairing(7, 10, 10, 4), pairing(10, 10, 4, 6)];
  const homeHandicap = 7.9 + 7.0 + 8.5; // JR + TOMMY + JAMEY = 23.4
  const awayHandicap = 8.0 + 6.9 + 7.4; // JOHN + ANDY + SATCH = 22.3

  it("reproduces every number the sheet recorded for that round", () => {
    const score = calculateRoundScore(realRound, homeHandicap, awayHandicap);

    // 1.4 and 0.3 over 22 -> difference 1.1 -> doubled 2.2 -> rounded 2,
    // to the away side. The sheet recorded exactly: home 53, away 38 + 2 = 40.
    expect(score.home.scoreSubtotal).toBe(53);
    expect(score.home.bonus).toBe(0);
    expect(score.home.roundTotal).toBe(53);
    expect(score.away.scoreSubtotal).toBe(38);
    expect(score.away.bonus).toBe(2);
    expect(score.away.roundTotal).toBe(40);
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
