import { notFound } from "next/navigation";
import { requireLeagueView } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { claimPlayer, unlinkPlayer } from "@/lib/roster-actions";
import { calculateStandings } from "@/lib/standings";
import LeagueHeader from "./LeagueHeader";
import LeagueTabs from "./LeagueTabs";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const access = await requireLeagueView(leagueId, `/leagues/${leagueId}`);

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      teams: { orderBy: { name: "asc" }, include: { players: { orderBy: { name: "asc" } } } },
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

  // Members pick which roster name is them, so they can enter their own scores.
  const myTeam = access.user
    ? league.teams.find((t) => t.players.some((p) => p.userId === access.user!.id))
    : undefined;
  const me = myTeam?.players.find((p) => p.userId === access.user?.id);
  const teamsWithOpenNames = league.teams
    .map((t) => ({ ...t, players: t.players.filter((p) => !p.userId) }))
    .filter((t) => t.players.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <LeagueHeader leagueId={league.id} leagueName={league.name} canEdit={access.canManage} />
      <LeagueTabs leagueId={league.id} active="standings" />

      {access.user && access.role && me && myTeam && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <span>
            You&apos;re <span className="font-medium text-neutral-900">{me.name}</span> on{" "}
            {myTeam.name}.
          </span>
          <form action={unlinkPlayer.bind(null, league.id, me.id)}>
            <button type="submit" className="text-neutral-500 underline">
              Not you?
            </button>
          </form>
        </div>
      )}

      {access.user && access.role && !me && teamsWithOpenNames.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-4">
          <div>
            <h2 className="font-semibold">Which player are you?</h2>
            <p className="text-sm text-neutral-500">
              Tap your name so you can enter the scores for your own table.
            </p>
          </div>
          {teamsWithOpenNames.map((team) => (
            <div key={team.id} className="flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {team.name}
              </div>
              <div className="flex flex-wrap gap-2">
                {team.players.map((player) => (
                  <form key={player.id} action={claimPlayer.bind(null, league.id, player.id)}>
                    <button
                      type="submit"
                      className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                    >
                      {player.name}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-neutral-500">
            Not listed? Ask a league manager to add you to a team&apos;s roster.
          </p>
        </section>
      )}

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
