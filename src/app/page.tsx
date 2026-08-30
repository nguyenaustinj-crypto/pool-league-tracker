import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { calculateRoundScore } from "@/lib/scoring";

export default async function HomePage() {
  const matches = await prisma.match.findMany({
    orderBy: { date: "desc" },
    include: {
      homeTeam: true,
      awayTeam: true,
      rounds: {
        include: {
          pairings: { include: { homePlayer: true, awayPlayer: true } },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Matches</h1>
        <Link
          href="/matches/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          + New Match
        </Link>
      </div>

      {matches.length === 0 && (
        <p className="text-neutral-500">
          No matches yet. Add a couple of{" "}
          <Link href="/teams" className="underline">
            teams
          </Link>{" "}
          first, then start a match.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {matches.map((match) => {
          let homeTotal = 0;
          let awayTotal = 0;
          for (const round of match.rounds) {
            const homeHandicapTotal = round.pairings.reduce(
              (sum, p) => sum + p.homePlayer.rating,
              0
            );
            const awayHandicapTotal = round.pairings.reduce(
              (sum, p) => sum + p.awayPlayer.rating,
              0
            );
            const score = calculateRoundScore(round.pairings, homeHandicapTotal, awayHandicapTotal);
            homeTotal += score.home.roundTotal;
            awayTotal += score.away.roundTotal;
          }

          return (
            <li key={match.id}>
              <Link
                href={`/matches/${match.id}`}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-neutral-50"
              >
                <div>
                  <div className="font-medium">
                    {match.homeTeam.name} vs {match.awayTeam.name}
                  </div>
                  <div className="text-sm text-neutral-500">
                    {new Date(match.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-lg font-bold tabular-nums">
                  {homeTotal} – {awayTotal}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
