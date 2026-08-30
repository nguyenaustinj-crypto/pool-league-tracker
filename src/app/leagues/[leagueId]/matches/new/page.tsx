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

  if (teams.length < 2) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">New Match</h1>
        <p className="text-neutral-500">
          {league.name} needs at least 2 teams (each with 3+ players) before starting a match.{" "}
          <Link href={`/leagues/${league.id}`} className="underline">
            Set up teams
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
        <Link href={`/leagues/${league.id}`} className="underline">
          {league.name}
        </Link>
      </p>
      <h1 className="text-xl font-bold">New Match</h1>
      <NewMatchForm leagueId={league.id} teams={teams} />
    </div>
  );
}
