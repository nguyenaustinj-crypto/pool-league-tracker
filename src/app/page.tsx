import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { prisma } from "@/lib/prisma";
import { createLeague } from "@/lib/actions";
import { signInConfigured } from "@/lib/auth";
import { isEditor } from "@/lib/editor";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const leagues = await prisma.league.findMany({
    orderBy: { name: "asc" },
    include: { teams: true, matches: true },
  });
  const [user, canEdit] = await Promise.all([getCurrentUser(), isEditor()]);
  const showWelcome = !user && !canEdit;

  return (
    <div className="flex flex-col gap-6">
      {showWelcome && (
        <section className="flex flex-col gap-4 rounded-lg border bg-neutral-50 p-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">🎱 Pool League Tracker</h1>
            <p className="text-neutral-600">
              Standings, match scores, and team rosters for your pool league, right on your phone.
            </p>
          </div>
          {signInConfigured() && (
            <div className="sm:max-w-xs">
              <GoogleSignInButton />
            </div>
          )}
        </section>
      )}

      {showWelcome ? (
        <h2 className="text-lg font-semibold">Leagues</h2>
      ) : (
        <div>
          {user && (
            <p className="text-sm text-neutral-500">Welcome back, {user.name.split(" ")[0]}.</p>
          )}
          <h1 className="text-xl font-bold">Leagues</h1>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {leagues.map((league) => (
          <li key={league.id}>
            <Link
              href={`/leagues/${league.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-neutral-50"
            >
              <span className="font-medium">{league.name}</span>
              <span className="text-sm text-neutral-500">
                {league.teams.length} team{league.teams.length === 1 ? "" : "s"} ·{" "}
                {league.matches.length} match{league.matches.length === 1 ? "" : "es"}
              </span>
            </Link>
          </li>
        ))}
        {leagues.length === 0 && (
          <p className="text-neutral-500">
            No leagues yet.{canEdit && " Add your first one below."}
          </p>
        )}
      </ul>

      {canEdit && (
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
      )}
    </div>
  );
}
