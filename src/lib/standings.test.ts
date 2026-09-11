import { describe, it, expect } from "vitest";
import { calculateStandings } from "@/lib/standings";

/**
 * The subtle rule here is that standings count ROUND wins, not match wins
 * (league rules Rev 1.6, rule #12: "the team with the most round wins at
 * the end of the season will be the league champion"). A single match with
 * N tables contributes N independent outcomes, and a tied round is half a
 * point for both sides.
 *
 * Test rounds below give both players the same handicap so the handicap
 * bonus is zero and each side's round total is just its game score --
 * keeping these tests about standings, not about the scoring formula
 * (which scoring.test.ts covers).
 */

const TEAMS = [
  { id: "home", name: "Home Team" },
  { id: "away", name: "Away Team" },
];

/** One table, both players on equal handicaps, so bonus is 0. */
function round(homeScore: number, awayScore: number) {
  return {
    pairings: [
      {
        homeGame1: homeScore,
        homeGame2: 0,
        awayGame1: awayScore,
        awayGame2: 0,
        homePlayer: { rating: 5 },
        awayPlayer: { rating: 5 },
      },
    ],
  };
}

function match(...rounds: ReturnType<typeof round>[]) {
  return { homeTeamId: "home", awayTeamId: "away", rounds };
}

function standingFor(teamId: string, rows: ReturnType<typeof calculateStandings>) {
  const row = rows.find((r) => r.teamId === teamId);
  if (!row) throw new Error(`no standing row for ${teamId}`);
  return row;
}

describe("calculateStandings", () => {
  it("counts each round as its own win, not one win per match", () => {
    // ONE match, but three rounds, all won by the home side.
    const rows = calculateStandings(TEAMS, [match(round(10, 1), round(10, 2), round(10, 3))]);
    expect(standingFor("home", rows).wins).toBe(3);
    expect(standingFor("away", rows).losses).toBe(3);
    expect(standingFor("home", rows).losses).toBe(0);
  });

  it("splits a tied round as half a win and half a loss for both sides", () => {
    const rows = calculateStandings(TEAMS, [match(round(7, 7))]);
    const home = standingFor("home", rows);
    const away = standingFor("away", rows);

    expect(home.wins).toBe(0.5);
    expect(home.losses).toBe(0.5);
    expect(home.ties).toBe(1);
    expect(away.wins).toBe(0.5);
    expect(away.losses).toBe(0.5);
    expect(away.ties).toBe(1);
  });

  it("produces the fractional win totals the real league reports use", () => {
    // Two clean wins plus a tie = 2.5, which is why the league's own stats
    // sheet shows figures like "35.5 wins".
    const rows = calculateStandings(TEAMS, [match(round(10, 1), round(10, 2), round(5, 5))]);
    expect(standingFor("home", rows).wins).toBe(2.5);
    expect(standingFor("away", rows).wins).toBe(0.5);
  });

  it("totals points from every round across every match", () => {
    const rows = calculateStandings(TEAMS, [
      match(round(10, 4), round(8, 6)),
      match(round(3, 9)),
    ]);
    expect(standingFor("home", rows).points).toBe(21); // 10 + 8 + 3
    expect(standingFor("away", rows).points).toBe(19); // 4 + 6 + 9
  });

  it("counts wins and losses symmetrically between the two sides", () => {
    const rows = calculateStandings(TEAMS, [match(round(10, 1), round(2, 9), round(4, 4))]);
    const home = standingFor("home", rows);
    const away = standingFor("away", rows);

    expect(home.wins + away.wins).toBe(3);
    expect(home.losses + away.losses).toBe(3);
    expect(home.wins).toBe(away.losses);
    expect(away.wins).toBe(home.losses);
  });

  it("lists teams that haven't played yet, at zero", () => {
    const rows = calculateStandings([...TEAMS, { id: "new", name: "New Team" }], []);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({ wins: 0, losses: 0, ties: 0, points: 0 });
    }
  });

  it("ranks by wins, breaking ties on points", () => {
    const teams = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ];
    const rows = calculateStandings(teams, [
      // A wins its one round, scoring 10.
      { homeTeamId: "a", awayTeamId: "b", rounds: [round(10, 9)] },
      // C also wins exactly one round, but racked up more points doing it.
      { homeTeamId: "c", awayTeamId: "b", rounds: [round(25, 0)] },
    ]);

    expect(rows.map((r) => r.teamId)).toEqual(["c", "a", "b"]);
    expect(standingFor("c", rows).wins).toBe(standingFor("a", rows).wins);
    expect(standingFor("c", rows).points).toBeGreaterThan(standingFor("a", rows).points);
  });

  it("ignores matches referencing a team outside this league", () => {
    const rows = calculateStandings(TEAMS, [
      { homeTeamId: "home", awayTeamId: "someone-elses-team", rounds: [round(10, 0)] },
    ]);
    expect(standingFor("home", rows).wins).toBe(0);
    expect(standingFor("home", rows).points).toBe(0);
  });

  it("includes the handicap bonus in points, not just raw game scores", () => {
    // 24 and 23 are 2 and 1 over 22 -> difference 1, doubled -> +2 to the
    // away side, so its points should exceed its raw game score.
    const rows = calculateStandings(TEAMS, [
      {
        homeTeamId: "home",
        awayTeamId: "away",
        rounds: [
          {
            pairings: [
              {
                homeGame1: 5,
                homeGame2: 0,
                awayGame1: 4,
                awayGame2: 0,
                homePlayer: { rating: 24 },
                awayPlayer: { rating: 23 },
              },
            ],
          },
        ],
      },
    ]);

    expect(standingFor("away", rows).points).toBe(6); // 4 scored + 2 bonus
    expect(standingFor("home", rows).points).toBe(5); // 5 scored, no bonus
    // And the bonus is enough to flip who actually won that round.
    expect(standingFor("away", rows).wins).toBe(1);
    expect(standingFor("home", rows).losses).toBe(1);
  });

  it("skips rounds nobody has scored yet, even when the handicap bonus would decide them", () => {
    // 24 vs 23 gives the away side a +2 bonus -- enough to "win" a round in
    // which no one has played a game. An unplayed round isn't a result at all.
    const unplayed = {
      pairings: [
        {
          homeGame1: 0,
          homeGame2: 0,
          awayGame1: 0,
          awayGame2: 0,
          homePlayer: { rating: 24 },
          awayPlayer: { rating: 23 },
        },
      ],
    };
    const rows = calculateStandings(TEAMS, [
      { homeTeamId: "home", awayTeamId: "away", rounds: [round(10, 4), unplayed, unplayed] },
    ]);

    expect(standingFor("home", rows)).toMatchObject({ wins: 1, losses: 0, ties: 0, points: 10 });
    expect(standingFor("away", rows)).toMatchObject({ wins: 0, losses: 1, ties: 0, points: 4 });
  });

  it("gives an entirely unscored match no effect on standings", () => {
    const rows = calculateStandings(TEAMS, [match(round(0, 0), round(0, 0), round(0, 0))]);
    for (const row of rows) {
      expect(row).toMatchObject({ wins: 0, losses: 0, ties: 0, points: 0 });
    }
  });
});
