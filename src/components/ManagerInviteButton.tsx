"use client";

import { useActionState } from "react";
import type { ManagerInviteState } from "@/lib/membership-actions";
import InviteLinkBox from "./InviteLinkBox";

const initialState: ManagerInviteState = { url: null };

/**
 * Creates a one-time manager invite link and shows it once. `action` is
 * createManagerInvite, already bound to the league.
 */
export default function ManagerInviteButton({
  action,
  leagueName,
}: {
  action: (prevState: ManagerInviteState) => Promise<ManagerInviteState>;
  leagueName: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="flex flex-col gap-3">
      {state.url && (
        <>
          <InviteLinkBox
            url={state.url}
            shareText={`You're invited to help manage ${leagueName} on Pool League Tracker.`}
          />
          <p className="text-xs text-neutral-500">
            This link works once, for one person, and expires in 14 days. It&apos;s only shown
            now, so send it before leaving this page. You can always make another.
          </p>
        </>
      )}
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending
            ? "Creating…"
            : state.url
              ? "Make another manager invite"
              : "Create a manager invite link"}
        </button>
      </form>
    </div>
  );
}
