import { describe, it, expect } from "vitest";
import { calculatePlayerStats, type PlayerPairing } from "@/lib/player-stats";

/**
 * A player's own record, as the home page shows it. The numbers below come
 * from the real played paper sheet (`Billardscoresheet-*`), round 1: JR 6+10
 * against JOHN 10+4, TOMMY 7+10 against ANDY 10+4, JAMEY 10+10 against SATCH
 * 4+6. Getting these wrong is quiet -- nobody checks their own totals by hand
 * -- so they're pinned here.
 */

function card(
  matchId: string,
  homePlayerId: string,
  awayPlayerId: string,
  scores: [number, number, number, number],
  eros: Partial<{ h1: boolean; h2: boolean; a1: boolean; a2: boolean }> = {}
): PlayerPairing {
  const [homeGame1, homeGame2, awayGame1, awayGame2] = scores;
  return {
    matchId,
    homePlayerId,
    awayPlayerId,
    homeGame1,
    homeGame2,
    awayGame1,
    awayGame2,
    homeGame1Ero: eros.h1 ?? false,
    homeGame2Ero: eros.h2 ?? false,
    awayGame1Ero: eros.a1 ?? false,
    awayGame2Ero: eros.a2 ?? false,
  };
}

const REAL_ROUND = [
  card("m1", "jr", "john", [6, 10, 10, 4]),
  card("m1", "tommy", "andy", [7, 10, 10, 4]),
  card("m1", "jamey", "satch", [10, 10, 4, 6]),
];

describe("calculatePlayerStats", () => {
  it("counts a home player's own games, wins and points from the real sheet", () => {
    const jr = calculatePlayerStats("jr", REAL_ROUND);
    // JR lost game 1 with 6 balls, then won game 2.
    expect(jr.gamesPlayed).toBe(2);
    expect(jr.gamesWon).toBe(1);
    expect(jr.gamesLost).toBe(1);
    expect(jr.points).toBe(16);
    expect(jr.winPercent).toBe(50);
    expect(jr.pointsPerGame).toBe(8);
    expect(jr.matchesPlayed).toBe(1);
  });

  it("reads the away side of the same cards", () => {
    const john = calculatePlayerStats("john", REAL_ROUND);
    expect(john.gamesWon).toBe(1);
    expect(john.gamesLost).toBe(1);
    expect(john.points).toBe(14);
  });

  it("gives a clean sweep 100%", () => {
    const jamey = calculatePlayerStats("jamey", REAL_ROUND);
    expect(jamey.gamesWon).toBe(2);
    expect(jamey.gamesLost).toBe(0);
    expect(jamey.points).toBe(20);
    expect(jamey.winPercent).toBe(100);
  });

  it("ignores cards the player isn't at", () => {
    expect(calculatePlayerStats("nobody", REAL_ROUND).gamesPlayed).toBe(0);
    expect(calculatePlayerStats("nobody", REAL_ROUND).winPercent).toBeNull();
    expect(calculatePlayerStats("nobody", REAL_ROUND).pointsPerGame).toBeNull();
  });

  it("skips games nobody has entered yet, rather than counting them as losses", () => {
    // The second game of this card is still blank.
    const stats = calculatePlayerStats("jr", [card("m1", "jr", "john", [10, 0, 3, 0])]);
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.gamesWon).toBe(1);
    expect(stats.gamesLost).toBe(0);
    expect(stats.points).toBe(10);
  });

  it("counts a match with nothing entered as not played", () => {
    const stats = calculatePlayerStats("jr", [card("m1", "jr", "john", [0, 0, 0, 0])]);
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.gamesPlayed).toBe(0);
  });

  it("counts each match once, however many rounds the player appears in", () => {
    const stats = calculatePlayerStats("jr", [
      card("m1", "jr", "john", [10, 10, 2, 3]),
      card("m1", "jr", "andy", [10, 4, 1, 10]),
      card("m2", "jr", "satch", [10, 10, 0, 1]),
    ]);
    expect(stats.matchesPlayed).toBe(2);
    expect(stats.gamesPlayed).toBe(6);
    expect(stats.gamesWon).toBe(5);
  });

  it("counts only the player's own EROs, not their opponent's", () => {
    const stats = calculatePlayerStats("jr", [
      card("m1", "jr", "john", [10, 5, 0, 10], { h1: true, a2: true }),
    ]);
    expect(stats.eros).toBe(1);
    expect(calculatePlayerStats("john", [
      card("m1", "jr", "john", [10, 5, 0, 10], { h1: true, a2: true }),
    ]).eros).toBe(1);
  });

  it("adds up a forfeit's decimal points without float noise", () => {
    // A missing player gets their handicap (7.9, capped at 7) -- decimals that
    // would otherwise show up as 13.299999999999999.
    const stats = calculatePlayerStats("jr", [card("m1", "jr", "john", [6.3, 7, 10, 10])]);
    expect(stats.points).toBe(13.3);
    expect(stats.gamesLost).toBe(2);
    expect(stats.pointsPerGame).toBe(6.7);
  });
});
