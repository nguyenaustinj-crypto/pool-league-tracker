import type { Metadata } from "next";
import Link from "next/link";
import { getLeagueAccess, requireSignedIn } from "@/lib/access";
import { resolveInvite } from "@/lib/invites";
import { acceptInvite } from "@/lib/membership-actions";

export const metadata: Metadata = {
  title: "League invite · Pool League Tracker",
};

// Opening an invite link never changes anything by itself (link previews in
// texting apps open links too); joining takes a tap on the button.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requireSignedIn(`/invite/${token}`);

  const invite = await resolveInvite(token);
  if (!invite) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">This invite link doesn&apos;t work anymore</h1>
        <p className="text-neutral-600">
          It may have been reset, already used, or expired. Ask whoever sent it for a new one, or
          find the league by name and ask to join.
        </p>
        <Link href="/" className="self-start text-sm underline">
          Go to My leagues
        </Link>
      </div>
    );
  }

  const access = await getLeagueAccess(invite.leagueId);
  const asManager = invite.role === "MANAGER";
  const alreadyThere = asManager ? access.role === "MANAGER" : access.role !== null;

  if (alreadyThere) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">{invite.leagueName}</h1>
        <p className="text-neutral-600">
          {asManager ? "You're already a manager of this league." : "You're already in this league."}
        </p>
        <Link
          href={`/leagues/${invite.leagueId}`}
          className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Open the league
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">You&apos;re invited to</p>
      <h1 className="text-xl font-bold">{invite.leagueName}</h1>
      <p className="text-neutral-600">
        {asManager
          ? "as a manager: you'll be able to change rosters, matches, and scores, and let people in."
          : "as a player: you'll be able to see the league's standings, teams, and scores."}
      </p>
      <form action={acceptInvite.bind(null, token)}>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          {asManager ? "Become a manager" : "Join the league"}
        </button>
      </form>
    </div>
  );
}
