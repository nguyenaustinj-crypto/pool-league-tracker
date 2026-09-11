// Fills an EMPTY development database with a small, realistic test league so
// local work doesn't start from a blank screen. Run with `npx prisma db seed`.
//
// Refuses to touch a database that already has leagues, so if DATABASE_URL
// is ever pointed at production by mistake, this does nothing.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { awayIndexForRound } from "../src/lib/scoring";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** One game's points: [home, away]. The winner gets 10; the loser 0–7. */
type Game = [home: number, away: number];
/** scores[round][table] = [game 1, game 2] */
type MatchScores = [Game, Game][][];

async function createMatch(opts: {
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  homePlayerIds: string[];
  awayPlayerIds: string[];
  daysAgo: number;
  scores?: MatchScores;
}) {
  const tableCount = opts.homePlayerIds.length;
  await prisma.match.create({
    data: {
      leagueId: opts.leagueId,
      homeTeamId: opts.homeTeamId,
      awayTeamId: opts.awayTeamId,
      date: new Date(Date.now() - opts.daysAgo * 24 * 60 * 60 * 1000),
      // Same round-robin schedule createMatch in src/lib/actions.ts builds.
      rounds: {
        create: Array.from({ length: tableCount }, (_, roundIndex) => ({
          roundNumber: roundIndex + 1,
          pairings: {
            create: opts.homePlayerIds.map((homePlayerId, homeIndex) => {
              const [game1, game2] = opts.scores?.[roundIndex]?.[homeIndex] ?? [
                [0, 0],
                [0, 0],
              ];
              return {
                homePlayerId,
                awayPlayerId: opts.awayPlayerIds[awayIndexForRound(homeIndex, roundIndex, tableCount)],
                homeGame1: game1[0],
                awayGame1: game1[1],
                homeGame2: game2[0],
                awayGame2: game2[1],
              };
            }),
          },
        })),
      },
    },
  });
}

async function main() {
  const existingLeagues = await prisma.league.count();
  if (existingLeagues > 0) {
    console.error(
      `Refusing to seed: this database already has ${existingLeagues} league(s). ` +
        "Seeding is only for an empty development database -- check that DATABASE_URL " +
        "in .env isn't the production database."
    );
    process.exitCode = 1;
    return;
  }

  const league = await prisma.league.create({ data: { name: "Dev Test League" } });

  // Names are in alphabetical order so they match the roster's display order.
  const teamSpecs: { name: string; players: [string, number][] }[] = [
    // 7.9 + 7.0 + 8.5 = 23.4 and 8.0 + 6.9 + 7.4 = 22.3: the handicaps from
    // the real paper sheet, so their 3-table match earns the +2 bonus.
    { name: "Corner Pocket", players: [["Alex", 7.9], ["Blake", 7.0], ["Casey", 8.5]] },
    { name: "Bank Shots", players: [["Devon", 8.0], ["Emery", 6.9], ["Finley", 7.4]] },
    { name: "Scratch Club", players: [["Gray", 5.5], ["Harper", 6.0], ["Indy", 6.5], ["Jordan", 4.8]] },
  ];

  const [cornerPocket, bankShots, scratchClub] = await Promise.all(
    teamSpecs.map((spec) =>
      prisma.team.create({
        data: {
          name: spec.name,
          leagueId: league.id,
          players: { create: spec.players.map(([name, rating]) => ({ name, rating })) },
        },
        include: { players: { orderBy: { name: "asc" } } },
      })
    )
  );
  const ids = (team: typeof cornerPocket, count: number) =>
    team.players.slice(0, count).map((p) => p.id);

  // Fully scored 3-table match. Round 1 is the real paper sheet's round
  // (53 to 38, +2 bonus to the away side = 53 to 40).
  await createMatch({
    leagueId: league.id,
    homeTeamId: cornerPocket.id,
    awayTeamId: bankShots.id,
    homePlayerIds: ids(cornerPocket, 3),
    awayPlayerIds: ids(bankShots, 3),
    daysAgo: 14,
    scores: [
      [[[6, 10], [10, 4]], [[7, 10], [10, 4]], [[10, 4], [10, 6]]],
      [[[10, 3], [5, 10]], [[2, 10], [10, 7]], [[10, 0], [10, 5]]],
      [[[4, 10], [10, 6]], [[10, 2], [10, 1]], [[7, 10], [3, 10]]],
    ],
  });

  // Fully scored 2-table match whose second round is a tie (31 to 31), so
  // standings show half wins.
  await createMatch({
    leagueId: league.id,
    homeTeamId: scratchClub.id,
    awayTeamId: cornerPocket.id,
    homePlayerIds: ids(scratchClub, 2),
    awayPlayerIds: ids(cornerPocket, 2),
    daysAgo: 7,
    scores: [
      [[[10, 6], [7, 10]], [[10, 5], [3, 10]]],
      [[[10, 4], [6, 10]], [[5, 10], [10, 7]]],
    ],
  });

  // Tonight's match, not scored yet -- for trying out score entry.
  await createMatch({
    leagueId: league.id,
    homeTeamId: bankShots.id,
    awayTeamId: scratchClub.id,
    homePlayerIds: ids(bankShots, 3),
    awayPlayerIds: ids(scratchClub, 3),
    daysAgo: 0,
  });

  console.log("Seeded \"Dev Test League\": 3 teams, 10 players, 3 matches.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
