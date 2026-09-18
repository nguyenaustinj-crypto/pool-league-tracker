"use client";

import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** An invite link with Copy and (on phones) Share buttons. */
export default function InviteLinkBox({ url, shareText }: { url: string; shareText: string }) {
  const [copied, setCopied] = useState(false);
  // Phones have a share sheet (text, email, ...); most desktop browsers don't.
  // Checked this way so the server render and first browser render agree.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still in the box to copy by hand.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Pool League Tracker", text: shareText, url });
    } catch {
      // Share sheet closed without sharing.
    }
  }

  const button = "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-neutral-50";

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        readOnly
        value={url}
        aria-label="Invite link"
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-md border bg-neutral-50 px-3 py-2 font-mono text-xs"
      />
      <div className="flex gap-2">
        <button type="button" onClick={copy} className={button}>
          {copied ? "Copied!" : "Copy link"}
        </button>
        {canShare && (
          <button type="button" onClick={share} className={button}>
            Share…
          </button>
        )}
      </div>
    </div>
  );
}
