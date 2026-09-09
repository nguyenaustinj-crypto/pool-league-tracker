import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createPlayer, updateTeam, deleteTeam } from "@/lib/actions";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ leagueId: string; teamId: string }>;
}) {
  const { leagueId, teamId } = await params;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { league: true, players: { orderBy: { name: "asc" } } },
  });
  if (!team || team.leagueId !== leagueId) notFound();

  const matchCount = await prisma.match.count({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  });

  const createPlayerOnTeam = createPlayer.bind(null, leagueId, teamId);
  const updateThisTeam = updateTeam.bind(null, leagueId, teamId);
  const deleteThisTeam = deleteTeam.bind(null, leagueId, teamId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/" className="underline">
            Leagues
          </Link>{" "}
          /{" "}
          <Link href={`/leagues/${leagueId}/teams`} className="underline">
            {team.league.name}
          </Link>
        </p>
        <h1 className="text-xl font-bold">{team.name}</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Players</h2>
        <ul className="flex flex-col gap-2">
          {team.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span>{player.name}</span>
              <span className="flex items-center gap-3 text-sm text-neutral-500">
                Handicap {player.rating}
                <Link
                  href={`/leagues/${leagueId}/players/${player.id}/edit`}
                  className="underline"
                >
                  Edit
                </Link>
              </span>
            </li>
          ))}
          {team.players.length === 0 && (
            <p className="text-neutral-500">No players yet. Add the first one below.</p>
          )}
        </ul>
        <form
          action={createPlayerOnTeam}
          className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row"
        >
          <input
            type="text"
            name="name"
            placeholder="Player name"
            required
            className="flex-1 rounded-md border px-3 py-2"
          />
          <input
            type="number"
            name="rating"
            placeholder="Handicap"
            step="0.1"
            required
            className="rounded-md border px-3 py-2 sm:w-28"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Rename team</h2>
        <form action={updateThisTeam} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row">
          <input
            type="text"
            name="name"
            defaultValue={team.name}
            required
            className="flex-1 rounded-md border px-3 py-2"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-red-300 p-4">
        <h2 className="font-semibold text-red-700">Delete this team</h2>
        {matchCount > 0 ? (
          <p className="text-sm text-neutral-600">
            {team.name} has played in {matchCount} existing match{matchCount === 1 ? "" : "es"} and
            can&apos;t be deleted. Delete those matches first.
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              This permanently removes {team.name} and every player on it. There&apos;s no undo.
            </p>
            <form action={deleteThisTeam}>
              <button
                type="submit"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                Delete {team.name}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
