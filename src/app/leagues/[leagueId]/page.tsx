import { notFound } from "next/navigation";
import { requireLeagueView } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { addMeAsPlayer, claimPlayer, renameMyPlayer, unlinkPlayer } from "@/lib/roster-actions";
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
      rounds: { include: { pairings: true } },
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
        <div className="flex flex-col gap-2 text-sm text-neutral-600">
          <div className="flex flex-wrap items-center gap-2">
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
          <details>
            <summary className="cursor-pointer text-neutral-500 underline">Fix my name</summary>
            <form
              action={renameMyPlayer.bind(null, league.id, me.id)}
              className="mt-2 flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                name="name"
                defaultValue={me.name}
                required
                aria-label="Your name"
                className="rounded-md border px-3 py-2 sm:w-64"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              >
                Save
              </button>
            </form>
            <p className="mt-1 text-xs text-neutral-500">
              This is the name everyone sees on the score sheet.
            </p>
          </details>
        </div>
      )}

      {access.user && access.role && !me && league.teams.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-4">
          <div>
            <h2 className="font-semibold">Which player are you?</h2>
            <p className="text-sm text-neutral-500">
              Tap your name so you can enter the scores for your own table.
            </p>
          </div>
          {teamsWithOpenNames.length === 0 && (
            <p className="text-sm text-neutral-600">
              Every name on this league&apos;s rosters is taken, so add yourself below.
            </p>
          )}
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
          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium">I&apos;m not on the list</summary>
            <p className="mt-2 text-sm text-neutral-500">
              Adds you to a team&apos;s roster. A manager sets your handicap at the start of each
              match, so a rough number is fine.
            </p>
            <form action={addMeAsPlayer.bind(null, league.id)} className="mt-3 flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Your team
                <select name="teamId" required defaultValue="" className="rounded-md border px-3 py-2 font-normal">
                  <option value="" disabled>
                    Pick a team…
                  </option>
                  {league.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
                  Your name
                  <input
                    type="text"
                    name="name"
                    defaultValue={access.user.name}
                    required
                    className="rounded-md border px-3 py-2 font-normal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium sm:w-32">
                  Handicap
                  <input
                    type="number"
                    name="rating"
                    defaultValue={5}
                    step="0.1"
                    min="0"
                    max="20"
                    className="rounded-md border px-3 py-2 font-normal"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              >
                Add me to the roster
              </button>
            </form>
          </details>
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
