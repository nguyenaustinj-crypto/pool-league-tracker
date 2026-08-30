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
      homeTeam: { include: { league: true } },
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

  if (!match || match.homeTeam.leagueId !== leagueId) notFound();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        <Link href="/" className="underline">
          Leagues
        </Link>{" "}
        /{" "}
        <Link href={`/leagues/${leagueId}`} className="underline">
          {match.homeTeam.league.name}
        </Link>
      </p>
      <h1 className="text-xl font-bold">
        {match.homeTeam.name} vs {match.awayTeam.name}
      </h1>
      <p className="text-sm text-neutral-500">{new Date(match.date).toLocaleDateString()}</p>

      <MatchScoreSheet
        leagueId={leagueId}
        matchId={match.id}
        homeTeamName={match.homeTeam.name}
        awayTeamName={match.awayTeam.name}
        rounds={match.rounds}
      />
    </div>
  );
}
