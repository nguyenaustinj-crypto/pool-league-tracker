import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createTeam } from "@/lib/actions";
import LeagueHeader from "../LeagueHeader";
import LeagueTabs from "../LeagueTabs";

export default async function LeagueTeamsPage({
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

  const createTeamInLeague = createTeam.bind(null, league.id);

  return (
    <div className="flex flex-col gap-6">
      <LeagueHeader leagueId={league.id} leagueName={league.name} />
      <LeagueTabs leagueId={league.id} active="teams" />

      <section className="flex flex-col gap-3">
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
    </div>
  );
}
