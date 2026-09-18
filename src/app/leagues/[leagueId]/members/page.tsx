import { notFound } from "next/navigation";
import { requireLeagueManagerPage } from "@/lib/access";
import {
  addMeAsManager,
  approveJoinRequest,
  declineJoinRequest,
  removeMember,
  setMemberRole,
} from "@/lib/membership-actions";
import { prisma } from "@/lib/prisma";
import LeagueHeader from "../LeagueHeader";
import LeagueTabs from "../LeagueTabs";

const smallButton = "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-neutral-50";
const primaryButton = "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white";

export default async function LeagueMembersPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const access = await requireLeagueManagerPage(leagueId, `/leagues/${leagueId}/members`);

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      memberships: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
      joinRequests: {
        where: { status: "PENDING" },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!league) notFound();

  const managerCount = league.memberships.filter((m) => m.role === "MANAGER").length;

  return (
    <div className="flex flex-col gap-6">
      <LeagueHeader leagueId={league.id} leagueName={league.name} canEdit={access.canManage} />
      <LeagueTabs leagueId={league.id} active="members" canManage={access.canManage} />

      {access.isSiteAdmin && !access.role && access.user && (
        <section className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            You can see this league because you&apos;re a site admin, but you&apos;re not one of
            its members. Add yourself as a manager to run it and see it under My leagues.
          </p>
          <form action={addMeAsManager.bind(null, league.id)}>
            <button type="submit" className={primaryButton}>
              Add me as a manager
            </button>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Requests to join ({league.joinRequests.length})</h2>
        {league.joinRequests.length === 0 ? (
          <p className="text-sm text-neutral-500">No one is waiting to join.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {league.joinRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{request.user.name}</div>
                  <div className="truncate text-sm text-neutral-500">{request.user.email}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={approveJoinRequest.bind(null, league.id, request.id)}>
                    <button type="submit" className={primaryButton}>
                      Approve
                    </button>
                  </form>
                  <form action={declineJoinRequest.bind(null, league.id, request.id)}>
                    <button type="submit" className={smallButton}>
                      Decline
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Members ({league.memberships.length})</h2>
          <p className="text-sm text-neutral-500">
            Managers can change rosters, matches, and scores, and let people in. Players can view
            the league.
          </p>
        </div>
        {league.memberships.length === 0 ? (
          <p className="text-sm text-neutral-500">No members yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {league.memberships.map((member) => {
              const isManager = member.role === "MANAGER";
              const isLastManager = isManager && managerCount === 1;
              const isYou = member.userId === access.user?.id;
              return (
                <li
                  key={member.userId}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {member.user.name}
                        {isYou && <span className="text-neutral-500"> (you)</span>}
                      </span>
                      <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                        {isManager ? "Manager" : "Player"}
                      </span>
                    </div>
                    <div className="truncate text-sm text-neutral-500">{member.user.email}</div>
                  </div>
                  {isLastManager ? (
                    <span className="shrink-0 text-xs text-neutral-500">Only manager</span>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      <form
                        action={setMemberRole.bind(
                          null,
                          league.id,
                          member.userId,
                          isManager ? "PLAYER" : "MANAGER"
                        )}
                      >
                        <button type="submit" className={smallButton}>
                          {isManager ? "Make player" : "Make manager"}
                        </button>
                      </form>
                      <form action={removeMember.bind(null, league.id, member.userId)}>
                        <button
                          type="submit"
                          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
