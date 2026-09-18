import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueManagerPage } from "@/lib/access";
import { siteOrigin } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import InvitePanel from "../InvitePanel";

// Where a new league's creator lands: invite people now, or skip it and do it
// later from the Members tab.
export default async function LeagueSetupPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const access = await requireLeagueManagerPage(leagueId, `/leagues/${leagueId}/setup`);

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, inviteToken: true },
  });
  if (!league) notFound();

  const playerInviteUrl = league.inviteToken
    ? `${await siteOrigin()}/invite/${league.inviteToken}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{league.name} is ready</h1>
        <p className="text-neutral-600">
          You&apos;re its manager. Invite people now, or skip this and do it any time from the
          league&apos;s Members tab.
        </p>
      </div>

      <section className="rounded-lg border p-4">
        <InvitePanel
          leagueId={league.id}
          leagueName={league.name}
          playerInviteUrl={playerInviteUrl}
          canManage={access.canManage}
          showReset={false}
        />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/leagues/${league.id}/teams`}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Next: add teams
        </Link>
        <Link href={`/leagues/${league.id}`} className="text-sm text-neutral-500 underline">
          Skip for now
        </Link>
      </div>
    </div>
  );
}
