import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createTeam } from "@/lib/actions";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { players: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Teams</h1>

      <ul className="flex flex-col gap-3">
        {teams.map((team) => (
          <li key={team.id}>
            <Link
              href={`/teams/${team.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-neutral-50"
            >
              <span className="font-medium">{team.name}</span>
              <span className="text-sm text-neutral-500">
                {team.players.length} player{team.players.length === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
        {teams.length === 0 && (
          <p className="text-neutral-500">No teams yet. Add your first one below.</p>
        )}
      </ul>

      <form action={createTeam} className="flex gap-2 rounded-lg border p-4">
        <input
          type="text"
          name="name"
          placeholder="Team name"
          required
          className="flex-1 rounded-md border px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add Team
        </button>
      </form>
    </div>
  );
}
