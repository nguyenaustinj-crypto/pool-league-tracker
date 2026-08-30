import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MatchScoreSheet from "./MatchScoreSheet";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
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

  if (!match) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">
        {match.homeTeam.name} vs {match.awayTeam.name}
      </h1>
      <p className="text-sm text-neutral-500">{new Date(match.date).toLocaleDateString()}</p>

      <MatchScoreSheet
        matchId={match.id}
        homeTeamName={match.homeTeam.name}
        awayTeamName={match.awayTeam.name}
        rounds={match.rounds}
      />
    </div>
  );
}
