import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import LeagueSearchForm from "@/components/LeagueSearchForm";
import { createLeague } from "@/lib/actions";
import { signInConfigured } from "@/lib/auth";
import { editorPasscode, isSiteAdmin } from "@/lib/editor";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const withCounts = { _count: { select: { teams: true, matches: true } } } as const;

export default async function HomePage() {
  const [user, siteAdmin] = await Promise.all([getCurrentUser(), isSiteAdmin()]);
  if (!user && !siteAdmin) return <SignInScreen />;

  const memberships = user
    ? await prisma.leagueMembership.findMany({
        where: { userId: user.id },
        include: { league: { include: withCounts } },
        orderBy: { league: { name: "asc" } },
      })
    : [];
  // Site admins can open any league, so they also see the ones they're not in.
  const otherLeagues = siteAdmin
    ? await prisma.league.findMany({
        where: { id: { notIn: memberships.map((m) => m.leagueId) } },
        include: withCounts,
        orderBy: { name: "asc" },
      })
    : [];

  const findLeague = user && (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Find a league</h2>
        <p className="text-sm text-neutral-500">
          Search by name and ask to join. One of the league&apos;s managers approves each request.
        </p>
      </div>
      <LeagueSearchForm />
    </section>
  );

  const startLeague = (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-semibold">Start a new league</summary>
      <p className="mt-2 text-sm text-neutral-500">
        You&apos;ll be its manager: you add the teams and players, set up matches, and decide who
        gets in.
      </p>
      <form action={createLeague} className="mt-3 flex flex-col gap-2 sm:flex-row">
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
          Create league
        </button>
      </form>
    </details>
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          {user && (
            <p className="text-sm text-neutral-500">Welcome back, {user.name.split(" ")[0]}.</p>
          )}
          <h1 className="text-xl font-bold">My leagues</h1>
        </div>
        {memberships.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {memberships.map((m) => (
              <LeagueRow
                key={m.leagueId}
                league={m.league}
                badge={m.role === "MANAGER" ? "Manager" : undefined}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border bg-neutral-50 p-4 text-sm text-neutral-600">
            {user
              ? "You're not in any leagues yet. Search for your league below and ask to join, or start a new one."
              : "Sign in with Google to see your own leagues."}
          </p>
        )}
      </section>

      {/* With no leagues yet, finding one comes first. */}
      {memberships.length === 0 && findLeague}

      {otherLeagues.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Other leagues</h2>
            <p className="text-sm text-neutral-500">
              You can see these because you&apos;re a site admin.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {otherLeagues.map((league) => (
              <LeagueRow key={league.id} league={league} />
            ))}
          </ul>
        </section>
      )}

      {startLeague}

      {memberships.length > 0 && findLeague}
    </div>
  );
}

function LeagueRow({
  league,
  badge,
}: {
  league: { id: string; name: string; _count: { teams: number; matches: number } };
  badge?: string;
}) {
  const { teams, matches } = league._count;
  return (
    <li>
      <Link
        href={`/leagues/${league.id}`}
        className="flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-neutral-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{league.name}</span>
          {badge && (
            <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
              {badge}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm text-neutral-500">
          {teams} team{teams === 1 ? "" : "s"} · {matches} match{matches === 1 ? "" : "es"}
        </span>
      </Link>
    </li>
  );
}

function SignInScreen() {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="text-5xl" aria-hidden="true">
        🎱
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Pool League Tracker</h1>
        <p className="text-neutral-600">
          Standings, match scores, and team rosters for your pool league, right on your phone.
        </p>
      </div>
      {signInConfigured() ? (
        <div className="w-full max-w-xs">
          <GoogleSignInButton />
        </div>
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Sign-in isn&apos;t set up on this site yet.
        </p>
      )}
      {editorPasscode() && (
        <Link href="/login" className="text-sm text-neutral-500 underline">
          Other ways to sign in
        </Link>
      )}
    </div>
  );
}
