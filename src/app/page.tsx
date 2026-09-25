import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import LeagueSearchForm from "@/components/LeagueSearchForm";
import { createLeague } from "@/lib/actions";
import { signInConfigured } from "@/lib/auth";
import { editorPasscode, isSiteAdmin } from "@/lib/editor";
import { calculatePlayerStats } from "@/lib/player-stats";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { homePageCutoff, matchAhead } from "@/lib/upcoming-matches";
import ComingUp, { type ComingUpMatch } from "./ComingUp";
import MyStats, { type MyStatsLeague } from "./MyStats";

const withCounts = { _count: { select: { teams: true, matches: true } } } as const;

/** How many matches the home page lists before you go to a league's own list. */
const COMING_UP_LIMIT = 5;

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

  const { comingUp, statsLeagues, unclaimed } = await homeForPlayer(
    user?.id ?? null,
    memberships.map((m) => ({
      leagueId: m.leagueId,
      leagueName: m.league.name,
      // Site admins can manage any league, so they count as one here too.
      isManager: m.role === "MANAGER" || siteAdmin,
      hasTeams: m.league._count.teams > 0,
    }))
  );

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
    // Open from the start for someone with no leagues yet.
    <details className="rounded-lg border p-4" open={memberships.length === 0}>
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

      <ComingUp matches={comingUp} />

      <MyStats leagues={statsLeagues} unclaimed={unclaimed} />

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

interface HomeMembership {
  leagueId: string;
  leagueName: string;
  isManager: boolean;
  hasTeams: boolean;
}

/**
 * The two player-facing parts of the home page: what's coming up, and how
 * you're doing. Both are read from the score cards themselves, so there's
 * nothing extra to keep up to date.
 */
async function homeForPlayer(userId: string | null, memberships: HomeMembership[]) {
  const empty = {
    comingUp: [] as ComingUpMatch[],
    statsLeagues: [] as MyStatsLeague[],
    unclaimed: [] as { leagueId: string; leagueName: string }[],
  };
  if (!userId || memberships.length === 0) return empty;

  const leagueIds = memberships.map((m) => m.leagueId);
  const now = new Date();

  // The roster name this person has claimed in each league -- at most one per
  // league -- which is what makes a match "yours" and gives you a record.
  const myPlayers = await prisma.player.findMany({
    where: { userId, team: { leagueId: { in: leagueIds } } },
    select: {
      id: true,
      name: true,
      rating: true,
      team: { select: { name: true, leagueId: true } },
    },
  });
  const myPlayerInLeague = new Map(myPlayers.map((p) => [p.team.leagueId, p]));

  const [matches, myPairings] = await Promise.all([
    prisma.match.findMany({
      where: {
        leagueId: { in: leagueIds },
        // Locked means finished; matchAhead() drops the rest of the old ones.
        lockedAt: null,
        date: { gte: homePageCutoff(now) },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        lockedAt: true,
        leagueId: true,
        league: { select: { name: true } },
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        rounds: {
          orderBy: { roundNumber: "asc" },
          select: {
            roundNumber: true,
            pairings: {
              select: {
                tableNumber: true,
                homePlayerId: true,
                awayPlayerId: true,
                homePlayer: { select: { userId: true } },
                awayPlayer: { select: { userId: true } },
                status: true,
                enteredById: true,
                homeGame1: true,
                homeGame2: true,
                awayGame1: true,
                awayGame2: true,
              },
            },
          },
        },
      },
    }),
    myPlayers.length > 0
      ? prisma.pairing.findMany({
          where: {
            OR: [
              { homePlayerId: { in: myPlayers.map((p) => p.id) } },
              { awayPlayerId: { in: myPlayers.map((p) => p.id) } },
            ],
          },
          select: {
            homePlayerId: true,
            awayPlayerId: true,
            homeGame1: true,
            homeGame2: true,
            awayGame1: true,
            awayGame2: true,
            homeGame1Ero: true,
            homeGame2Ero: true,
            awayGame1Ero: true,
            awayGame2Ero: true,
            round: { select: { matchId: true } },
          },
        })
      : [],
  ]);

  const showLeagueName = memberships.length > 1;
  const membershipOf = new Map(memberships.map((m) => [m.leagueId, m]));
  const comingUp: ComingUpMatch[] = [];
  for (const match of matches) {
    const membership = membershipOf.get(match.leagueId);
    if (!membership) continue;

    const ahead = matchAhead(
      {
        date: match.date,
        lockedAt: match.lockedAt,
        rounds: match.rounds.map((round) => ({
          roundNumber: round.roundNumber,
          pairings: round.pairings.map((p) => ({
            ...p,
            homeUserId: p.homePlayer.userId,
            awayUserId: p.awayPlayer.userId,
          })),
        })),
      },
      {
        playerId: myPlayerInLeague.get(match.leagueId)?.id ?? null,
        userId,
        isManager: membership.isManager,
        now,
      }
    );
    if (!ahead) continue;

    comingUp.push({
      id: match.id,
      leagueId: match.leagueId,
      leagueName: match.league.name,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      date: match.date.toISOString(),
      showLeagueName,
      ...ahead,
    });
    if (comingUp.length === COMING_UP_LIMIT) break;
  }

  const pairingsForStats = myPairings.map((p) => ({ ...p, matchId: p.round.matchId }));
  const statsLeagues: MyStatsLeague[] = memberships.flatMap((membership) => {
    const player = myPlayerInLeague.get(membership.leagueId);
    if (!player) return [];
    return [
      {
        leagueId: membership.leagueId,
        leagueName: membership.leagueName,
        playerName: player.name,
        teamName: player.team.name,
        handicap: player.rating,
        stats: calculatePlayerStats(player.id, pairingsForStats),
      },
    ];
  });

  // Nudge people to pick their name, but only where there's a roster to pick from.
  const unclaimed = memberships
    .filter((m) => m.hasTeams && !myPlayerInLeague.has(m.leagueId))
    .map((m) => ({ leagueId: m.leagueId, leagueName: m.leagueName }));

  return { comingUp, statsLeagues, unclaimed };
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
