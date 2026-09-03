import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createTeam } from "@/lib/actions";
import { calculateRoundScore } from "@/lib/scoring";
import { calculateStandings } from "@/lib/standings";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      teams: { orderBy: { name: "asc" }, include: { players: true } },
    },
  });
  if (!league) notFound();

  const matches = await prisma.match.findMany({
    where: { leagueId },
    orderBy: { date: "desc" },
    include: {
      homeTeam: true,
      awayTeam: true,
      rounds: { include: { pairings: { include: { homePlayer: true, awayPlayer: true } } } },
    },
  });

  const createTeamInLeague = createTeam.bind(null, league.id);
  const standings = calculateStandings(league.teams, matches);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/" className="underline">
            Leagues
          </Link>
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{league.name}</h1>
          <Link href={`/leagues/${league.id}/edit`} className="text-sm text-neutral-500 underline">
            Edit League
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Standings</h2>
        {standings.length === 0 ? (
          <p className="text-neutral-500">No teams yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="border-b bg-neutral-50 text-left text-neutral-500">
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 text-right font-medium">W</th>
                  <th className="px-3 py-2 text-right font-medium">L</th>
                  <th className="px-3 py-2 text-right font-medium">T</th>
                  <th className="px-3 py-2 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.teamId} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium">{row.teamName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.losses}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.ties}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-neutral-500">
          Standings are round wins (per the league&apos;s rules, not just match wins), with a
          tied round counting as half a win and half a loss for both teams.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Teams</h2>
        <ul className="flex flex-col gap-2">
          {league.teams.map((team) => (
            <li key={team.id}>
              <Link
                href={`/leagues/${league.id}/teams/${team.id}`}
                className="flex items-center justify-between rounded-lg border p-3 hover:opacity-70"
              >
                <span className="font-medium">{team.name}</span>
                <span className="text-sm text-neutral-500">
                  {team.players.length} player{team.players.length === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
          {league.teams.length === 0 && (
            <p className="text-neutral-500">No teams yet. Add the first one below.</p>
          )}
        </ul>
        <form
          action={createTeamInLeague}
          className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row"
        >
          <input
            type="text"
            name="name"
            placeholder="Team name"
            required
            className="flex-1 rounded-md border px-3 py-2"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add Team
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
                <Link
                  href={`/leagues/${league.id}/matches/${match.id}/edit`}
                  className="self-end text-sm text-neutral-500 underline sm:ml-4 sm:shrink-0 sm:self-auto"
                >
                  Edit
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
