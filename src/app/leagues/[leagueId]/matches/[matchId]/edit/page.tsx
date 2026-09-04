import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteMatch } from "@/lib/actions";
import MatchEditForm from "./MatchEditForm";

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  const { leagueId, matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      league: true,
      homeTeam: true,
      awayTeam: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { pairings: { include: { homePlayer: true, awayPlayer: true } } },
      },
    },
  });
  if (!match || match.leagueId !== leagueId) notFound();

  const teams = await prisma.team.findMany({
    where: { leagueId },
    orderBy: { name: "asc" },
    include: { players: { orderBy: { name: "asc" } } },
  });

  const firstRound = match.rounds[0];
  const currentHomePlayerIds = firstRound?.pairings.map((p) => p.homePlayerId) ?? [];
  const currentAwayPlayerIds = firstRound?.pairings.map((p) => p.awayPlayerId) ?? [];
  const matchTitle = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const hasScores = match.rounds.some((r) =>
    r.pairings.some((p) => p.homeGame1 || p.homeGame2 || p.awayGame1 || p.awayGame2)
  );

  const deleteThisMatch = deleteMatch.bind(null, leagueId, matchId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/" className="underline">
            Leagues
          </Link>{" "}
          /{" "}
          <Link href={`/leagues/${leagueId}/matches`} className="underline">
            {match.league.name}
          </Link>{" "}
          /{" "}
          <Link href={`/leagues/${leagueId}/matches/${matchId}`} className="underline">
            {matchTitle}
          </Link>
        </p>
        <h1 className="text-xl font-bold">Edit Match</h1>
      </div>

      <MatchEditForm
        leagueId={leagueId}
        matchId={matchId}
        teams={teams}
        date={match.date.toISOString().slice(0, 10)}
        currentHomeTeamId={match.homeTeamId}
        currentAwayTeamId={match.awayTeamId}
        currentHomePlayerIds={currentHomePlayerIds}
        currentAwayPlayerIds={currentAwayPlayerIds}
        hasScores={hasScores}
      />

      <section className="flex flex-col gap-3 rounded-lg border border-red-300 p-4">
        <h2 className="font-semibold text-red-700">Delete this match</h2>
        <p className="text-sm text-neutral-600">
          This permanently deletes this match and every score recorded for it. There&apos;s no
          undo.
        </p>
        <form action={deleteThisMatch}>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            Delete Match
          </button>
        </form>
      </section>
    </div>
  );
}
