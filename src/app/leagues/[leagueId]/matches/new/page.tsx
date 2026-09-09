import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NewMatchForm from "./NewMatchForm";

export default async function NewMatchPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const teams = await prisma.team.findMany({
    where: { leagueId },
    orderBy: { name: "asc" },
    include: { players: { orderBy: { name: "asc" } } },
  });

  const eligibleTeams = teams.filter((t) => t.players.length > 0);
  if (eligibleTeams.length < 2) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">New Match</h1>
        <p className="text-neutral-500">
          {league.name} needs at least 2 teams with a player on each before starting a match.{" "}
          <Link href={`/leagues/${league.id}/teams`} className="underline">
            Add teams and players
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">
        <Link href="/" className="underline">
          Leagues
        </Link>{" "}
        /{" "}
        <Link href={`/leagues/${league.id}/matches`} className="underline">
          {league.name}
        </Link>
      </p>
      <h1 className="text-xl font-bold">New Match</h1>
      <NewMatchForm leagueId={league.id} teams={teams} />
    </div>
  );
}
