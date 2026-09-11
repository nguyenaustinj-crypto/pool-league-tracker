import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/editor";
import { calculateStandings } from "@/lib/standings";
import LeagueHeader from "./LeagueHeader";
import LeagueTabs from "./LeagueTabs";

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
    include: {
      rounds: { include: { pairings: { include: { homePlayer: true, awayPlayer: true } } } },
    },
  });

  const standings = calculateStandings(league.teams, matches);
  const canEdit = await isEditor();

  return (
    <div className="flex flex-col gap-6">
      <LeagueHeader leagueId={league.id} leagueName={league.name} canEdit={canEdit} />
      <LeagueTabs leagueId={league.id} active="standings" />

      <section className="flex flex-col gap-3">
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
    </div>
  );
}
