import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createPlayer } from "@/lib/actions";
import { calculateRoundScore } from "@/lib/scoring";
import { sideLabel } from "@/lib/format";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { players: { orderBy: { name: "asc" } } },
  });
  if (!league) notFound();

  const matches = await prisma.match.findMany({
    where: { leagueId },
    orderBy: { date: "desc" },
    include: {
      rounds: { include: { pairings: { include: { homePlayer: true, awayPlayer: true } } } },
    },
  });

  const createPlayerInLeague = createPlayer.bind(null, league.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/" className="underline">
            Leagues
          </Link>
        </p>
        <h1 className="text-xl font-bold">{league.name}</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Players</h2>
        <ul className="flex flex-col gap-2">
          {league.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span>{player.name}</span>
              <span className="text-sm text-neutral-500">Handicap {player.rating}</span>
            </li>
          ))}
          {league.players.length === 0 && (
            <p className="text-neutral-500">No players yet. Add the first one below.</p>
          )}
        </ul>
        <form action={createPlayerInLeague} className="flex gap-2 rounded-lg border p-3">
          <input
            type="text"
            name="name"
            placeholder="Player name"
            required
            className="flex-1 rounded-md border px-3 py-2"
          />
          <input
            type="number"
            name="rating"
            placeholder="Handicap"
            step="0.1"
            required
            className="w-28 rounded-md border px-3 py-2"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Matches</h2>
          <Link
            href={`/leagues/${league.id}/matches/new`}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            + New Match
          </Link>
        </div>
        <ul className="flex flex-col gap-2">
          {matches.map((match) => {
            let homeTotal = 0;
            let awayTotal = 0;
            const homePlayerNames = new Set<string>();
            const awayPlayerNames = new Set<string>();
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
              for (const p of round.pairings) {
                homePlayerNames.add(p.homePlayer.name);
                awayPlayerNames.add(p.awayPlayer.name);
              }
            }
            return (
              <li key={match.id}>
                <Link
                  href={`/leagues/${league.id}/matches/${match.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-neutral-50"
                >
                  <div>
                    <div className="font-medium">
                      {sideLabel(match.homeLabel, [...homePlayerNames])} vs{" "}
                      {sideLabel(match.awayLabel, [...awayPlayerNames])}
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
          {matches.length === 0 && <p className="text-neutral-500">No matches yet.</p>}
        </ul>
      </section>
    </div>
  );
}
