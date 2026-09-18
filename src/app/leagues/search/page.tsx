import type { Metadata } from "next";
import Link from "next/link";
import LeagueSearchForm from "@/components/LeagueSearchForm";
import { requireSignedIn } from "@/lib/access";
import { requestToJoin } from "@/lib/membership-actions";
import { normalizeLeagueSearch } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Find a league · Pool League Tracker",
};

export default async function LeagueSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = normalizeLeagueSearch(q);
  const user = await requireSignedIn(
    query ? `/leagues/search?q=${encodeURIComponent(query)}` : "/leagues/search"
  );

  // Search only ever reveals league names. Everything inside a league stays
  // private until a manager approves the request to join.
  const leagues = query
    ? await prisma.league.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        orderBy: { name: "asc" },
        take: 20,
        select: {
          id: true,
          name: true,
          memberships: { where: { userId: user.id }, select: { role: true } },
          joinRequests: { where: { userId: user.id }, select: { status: true } },
        },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/" className="underline">
            My leagues
          </Link>
        </p>
        <h1 className="text-xl font-bold">Find a league</h1>
      </div>

      <LeagueSearchForm defaultValue={query ?? ""} />

      {query &&
        (leagues.length === 0 ? (
          <p className="text-neutral-500">No leagues match &ldquo;{query}&rdquo;.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {leagues.map((league) => {
              const isMember = league.memberships.length > 0;
              const requested = league.joinRequests[0]?.status === "PENDING";
              return (
                <li
                  key={league.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="min-w-0 truncate font-medium">{league.name}</span>
                  {isMember ? (
                    <Link href={`/leagues/${league.id}`} className="shrink-0 text-sm underline">
                      Open
                    </Link>
                  ) : requested ? (
                    <span className="shrink-0 text-sm text-neutral-500">Request sent</span>
                  ) : (
                    <form action={requestToJoin.bind(null, league.id)} className="shrink-0">
                      <button
                        type="submit"
                        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Ask to join
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ))}

      <p className="text-xs text-neutral-500">
        Only league names show up here. A league&apos;s standings, teams, and scores stay private
        until one of its managers lets you in.
      </p>
    </div>
  );
}
