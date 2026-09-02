import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createLeague } from "@/lib/actions";

export default async function HomePage() {
  const leagues = await prisma.league.findMany({
    orderBy: { name: "asc" },
    include: { players: true, matches: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Leagues</h1>

      <ul className="flex flex-col gap-3">
        {leagues.map((league) => (
          <li key={league.id}>
            <Link
              href={`/leagues/${league.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-neutral-50"
            >
              <span className="font-medium">{league.name}</span>
              <span className="text-sm text-neutral-500">
                {league.players.length} player{league.players.length === 1 ? "" : "s"} ·{" "}
                {league.matches.length} match{league.matches.length === 1 ? "" : "es"}
              </span>
            </Link>
          </li>
        ))}
        {leagues.length === 0 && (
          <p className="text-neutral-500">No leagues yet. Add your first one below.</p>
        )}
      </ul>

      <form action={createLeague} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row">
        <input
          type="text"
          name="name"
          placeholder="League name"
          required
          className="flex-1 rounded-md border px-3 py-2"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add League
        </button>
      </form>
    </div>
  );
}
