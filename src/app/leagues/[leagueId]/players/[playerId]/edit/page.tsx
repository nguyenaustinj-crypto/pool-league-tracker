import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updatePlayer, deletePlayer } from "@/lib/actions";

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ leagueId: string; playerId: string }>;
}) {
  const { leagueId, playerId } = await params;
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: { include: { league: true } } },
  });
  if (!player || player.team.leagueId !== leagueId) notFound();

  const pairingCount = await prisma.pairing.count({
    where: { OR: [{ homePlayerId: playerId }, { awayPlayerId: playerId }] },
  });

  const updateThisPlayer = updatePlayer.bind(null, leagueId, playerId);
  const deleteThisPlayer = deletePlayer.bind(null, leagueId, playerId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/" className="underline">
            Leagues
          </Link>{" "}
          /{" "}
          <Link href={`/leagues/${leagueId}/teams`} className="underline">
            {player.team.league.name}
          </Link>{" "}
          /{" "}
          <Link href={`/leagues/${leagueId}/teams/${player.teamId}`} className="underline">
            {player.team.name}
          </Link>
        </p>
        <h1 className="text-xl font-bold">Edit Player</h1>
      </div>

      <form action={updateThisPlayer} className="flex flex-col gap-3 rounded-lg border p-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            type="text"
            name="name"
            defaultValue={player.name}
            required
            className="rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Handicap
          <input
            type="number"
            name="rating"
            step="0.1"
            defaultValue={player.rating}
            required
            className="rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <button
          type="submit"
          className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Save
        </button>
      </form>

      <section className="flex flex-col gap-3 rounded-lg border border-red-300 p-4">
        <h2 className="font-semibold text-red-700">Delete this player</h2>
        {pairingCount > 0 ? (
          <p className="text-sm text-neutral-600">
            {player.name} is part of {pairingCount} existing match pairing
            {pairingCount === 1 ? "" : "s"} and can&apos;t be deleted. Remove them from those
            matches&apos; lineups first (or edit the match and pick someone else).
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              This permanently removes {player.name} from the league. There&apos;s no undo.
            </p>
            <form action={deleteThisPlayer}>
              <button
                type="submit"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                Delete {player.name}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
