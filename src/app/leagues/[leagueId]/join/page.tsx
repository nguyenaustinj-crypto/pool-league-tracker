import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLeagueAccess, requireSignedIn } from "@/lib/access";
import { requestToJoin } from "@/lib/membership-actions";
import { prisma } from "@/lib/prisma";

// Where a signed-in non-member lands when they open a league: its name, and
// a way to ask to join. Nothing else about the league is shown.
export default async function JoinLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await requireSignedIn(`/leagues/${leagueId}/join`);

  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { name: true } });
  if (!league) notFound();

  const access = await getLeagueAccess(leagueId);
  if (access.canView) redirect(`/leagues/${leagueId}`);

  const request = await prisma.joinRequest.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    select: { status: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        <Link href="/" className="underline">
          My leagues
        </Link>
      </p>
      <h1 className="text-xl font-bold">{league.name}</h1>
      <p className="text-neutral-600">
        This league is private. Only its members can see its standings, teams, and scores.
      </p>

      {request?.status === "PENDING" ? (
        <p className="rounded-lg border bg-neutral-50 p-4 text-sm text-neutral-700">
          Request sent. Once a league manager approves it, this league will show up under My
          leagues.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {request?.status === "DECLINED" && (
            <p className="text-sm text-neutral-600">
              Your last request wasn&apos;t approved. You can ask again.
            </p>
          )}
          <form action={requestToJoin.bind(null, leagueId)}>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Ask to join
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
