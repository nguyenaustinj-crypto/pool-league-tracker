import InviteLinkBox from "@/components/InviteLinkBox";
import ManagerInviteButton from "@/components/ManagerInviteButton";
import { createManagerInvite, resetPlayerInviteLink } from "@/lib/membership-actions";

// A league's invite links: the reusable player link (anyone in the league can
// share it) and, for managers, one-time manager invites. Shown right after a
// league is created, and on its Members page.
export default function InvitePanel({
  leagueId,
  leagueName,
  playerInviteUrl,
  canManage,
  showReset = true,
}: {
  leagueId: string;
  leagueName: string;
  playerInviteUrl: string | null;
  canManage: boolean;
  /** Off for a brand-new league, whose link has nothing to reset yet. */
  showReset?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Invite players</h2>
          <p className="text-sm text-neutral-500">
            Anyone with this link can join {leagueName} as a player. Send it by text or email.
          </p>
        </div>
        {playerInviteUrl ? (
          <InviteLinkBox url={playerInviteUrl} shareText={`Join ${leagueName} on Pool League Tracker.`} />
        ) : canManage ? (
          <form action={resetPlayerInviteLink.bind(null, leagueId)}>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              Create the invite link
            </button>
          </form>
        ) : (
          <p className="text-sm text-neutral-500">
            There&apos;s no invite link yet. Ask one of the league&apos;s managers to create it.
          </p>
        )}
        {playerInviteUrl && canManage && showReset && (
          <form action={resetPlayerInviteLink.bind(null, leagueId)}>
            <button type="submit" className="text-sm text-neutral-500 underline">
              Reset the link (the old one stops working)
            </button>
          </form>
        )}
      </div>

      {canManage && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <div>
            <h2 className="font-semibold">Invite a manager</h2>
            <p className="text-sm text-neutral-500">
              For someone who&apos;ll help run the league. Each manager link works once.
            </p>
          </div>
          <ManagerInviteButton
            action={createManagerInvite.bind(null, leagueId)}
            leagueName={leagueName}
          />
        </div>
      )}
    </div>
  );
}
