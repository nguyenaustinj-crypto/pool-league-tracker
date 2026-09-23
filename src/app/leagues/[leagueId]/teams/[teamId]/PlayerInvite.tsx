import InviteLinkBox from "@/components/InviteLinkBox";
import { createPlayerInvite } from "@/lib/roster-actions";

// A share link for one roster name: whoever opens it joins the league and is
// linked to that name, so a manager can type a roster in and then hand each
// player their own link. Managers only.
export default function PlayerInvite({
  leagueId,
  leagueName,
  playerId,
  playerName,
  inviteUrl,
}: {
  leagueId: string;
  leagueName: string;
  playerId: string;
  playerName: string;
  inviteUrl: string | null;
}) {
  if (!inviteUrl) {
    return (
      <form action={createPlayerInvite.bind(null, leagueId, playerId)}>
        <button type="submit" className="text-sm text-neutral-500 underline">
          Invite {playerName}
        </button>
      </form>
    );
  }

  return (
    <details>
      <summary className="cursor-pointer text-sm text-neutral-500 underline">
        Invite link for {playerName}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <InviteLinkBox
          url={inviteUrl}
          shareText={`Join ${leagueName} on Pool League Tracker as ${playerName}.`}
        />
        <p className="text-xs text-neutral-500">
          Whoever opens this joins as {playerName}. It stops working once someone takes the name.
        </p>
        <form action={createPlayerInvite.bind(null, leagueId, playerId)}>
          <button type="submit" className="text-xs text-neutral-500 underline">
            New link (the old one stops working)
          </button>
        </form>
      </div>
    </details>
  );
}
