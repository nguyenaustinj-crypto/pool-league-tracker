import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/editor";
import { calculateRoundScore, isRoundPlayed } from "@/lib/scoring";
import LeagueHeader from "../LeagueHeader";
import LeagueTabs from "../LeagueTabs";

export default async function LeagueMatchesPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const canEdit = await isEditor();
  const matches = await prisma.match.findMany({
    where: { leagueId },
    orderBy: { date: "desc" },
    include: {
      homeTeam: true,
      awayTeam: true,
      rounds: { include: { pairings: { include: { homePlayer: true, awayPlayer: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <LeagueHeader leagueId={league.id} leagueName={league.name} canEdit={canEdit} />
      <LeagueTabs leagueId={league.id} active="matches" />

      <section className="flex flex-col gap-3">
        {canEdit && (
          <div className="flex items-center justify-end">
            <Link
              href={`/leagues/${league.id}/matches/new`}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              + New Match
            </Link>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {matches.map((match) => {
            let homeTotal = 0;
            let awayTotal = 0;
            for (const round of match.rounds) {
              // Unscored rounds don't count; the handicap bonus alone would
              // otherwise put points on the board before anyone plays.
              if (!isRoundPlayed(round.pairings)) continue;
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
              <li
                key={match.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/leagues/${league.id}/matches/${match.id}`}
                  className="flex flex-1 flex-col gap-1 hover:opacity-70 sm:flex-row sm:items-center sm:justify-between"
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
                {canEdit && (
                  <Link
                    href={`/leagues/${league.id}/matches/${match.id}/edit`}
                    className="self-end text-sm text-neutral-500 underline sm:ml-4 sm:shrink-0 sm:self-auto"
                  >
                    Edit
                  </Link>
                )}
              </li>
            );
          })}
          {matches.length === 0 && <p className="text-neutral-500">No matches yet.</p>}
        </ul>
      </section>
    </div>
  );
}
