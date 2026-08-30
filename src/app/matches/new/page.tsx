import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewMatchForm from "./NewMatchForm";

export default async function NewMatchPage() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { players: { orderBy: { name: "asc" } } },
  });

  if (teams.length < 2) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">New Match</h1>
        <p className="text-neutral-500">
          You need at least 2 teams (each with 3+ players) before starting a match.{" "}
          <Link href="/teams" className="underline">
            Set up teams
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">New Match</h1>
      <NewMatchForm teams={teams} />
    </div>
  );
}
