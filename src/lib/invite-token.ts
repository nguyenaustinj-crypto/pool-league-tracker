// Invite link tokens. Kept free of database and Next.js imports so the rules
// are unit-tested directly (invite-token.test.ts).
//
// - A league's player invite link is reusable: its token is stored as-is
//   on League.inviteToken so members can see and share it any time.
// - A manager invite is one-time: only a hash of its token is stored
//   (ManagerInvite.tokenHash), and the link is shown once, when created.

import { createHash, randomBytes } from "node:crypto";

export const MANAGER_INVITE_DAYS = 14;

/** A new unguessable token (32 URL-safe characters). */
export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Rejects anything that can't be one of our tokens, before touching the database. */
export function isWellFormedInviteToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32}$/.test(token);
}

export function managerInviteExpiry(now = Date.now()): Date {
  return new Date(now + MANAGER_INVITE_DAYS * 24 * 60 * 60 * 1000);
}
