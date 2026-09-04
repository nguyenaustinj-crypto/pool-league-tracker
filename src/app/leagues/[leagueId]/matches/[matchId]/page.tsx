import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MatchScoreSheet from "./MatchScoreSheet";

export default async function MatchPage({
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
        include: {
          pairings: {
            include: { homePlayer: true, awayPlayer: true },
          },
        },
      },
    },
  });

  if (!match || match.leagueId !== leagueId) notFound();

  const homeTeamName = match.homeTeam.name;
  const awayTeamName = match.awayTeam.name;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        <Link href="/" className="underline">
          Leagues
        </Link>{" "}
        /{" "}
        <Link href={`/leagues/${leagueId}/matches`} className="underline">
          {match.league.name}
        </Link>
      </p>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {homeTeamName} vs {awayTeamName}
        </h1>
        <Link
          href={`/leagues/${leagueId}/matches/${matchId}/edit`}
          className="text-sm text-neutral-500 underline"
        >
          Edit
        </Link>
      </div>
      <p className="text-sm text-neutral-500">{new Date(match.date).toLocaleDateString()}</p>

      <MatchScoreSheet
        leagueId={leagueId}
        matchId={match.id}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        rounds={match.rounds}
      />
    </div>
  );
}
