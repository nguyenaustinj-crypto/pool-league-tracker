import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createPlayer } from "@/lib/actions";

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

  const createPlayerForTeam = createPlayer.bind(null, team.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/" className="underline">
            Leagues
          </Link>{" "}
          /{" "}
          <Link href={`/leagues/${leagueId}`} className="underline">
            {team.league.name}
          </Link>
        </p>
        <h1 className="text-xl font-bold">{team.name}</h1>
      </div>

      <ul className="flex flex-col gap-2">
        {team.players.map((player) => (
          <li
            key={player.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <span>{player.name}</span>
            <span className="text-sm text-neutral-500">Handicap {player.rating}</span>
          </li>
        ))}
        {team.players.length === 0 && (
          <p className="text-neutral-500">No players yet. Add the roster below.</p>
        )}
      </ul>

      <form action={createPlayerForTeam} className="flex gap-2 rounded-lg border p-4">
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
          className="w-28 rounded-md border px-3 py-2"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add
        </button>
      </form>
    </div>
  );
}
