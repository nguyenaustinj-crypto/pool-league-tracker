import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sideLabel } from "@/lib/format";
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

  const firstRound = match.rounds[0];
  const homeTeamName = sideLabel(
    match.homeLabel,
    firstRound ? firstRound.pairings.map((p) => p.homePlayer.name) : []
  );
  const awayTeamName = sideLabel(
    match.awayLabel,
    firstRound ? firstRound.pairings.map((p) => p.awayPlayer.name) : []
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        <Link href="/" className="underline">
          Leagues
        </Link>{" "}
        /{" "}
        <Link href={`/leagues/${leagueId}`} className="underline">
          {match.league.name}
        </Link>
      </p>
      <h1 className="text-xl font-bold">
        {homeTeamName} vs {awayTeamName}
      </h1>
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
