// The rules behind the shared editor passcode, kept free of Next.js imports
// so they can be unit-tested directly. `src/lib/editor.ts` wires these up to
// the real request cookies.
//
// Deliberately not a user-account system: there's one shared passcode, kept
// only in the EDITOR_PASSCODE environment variable. Nothing about any person
// (no emails, no stored passwords) lives in the database.

import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const EDITOR_COOKIE = "editor_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const MIN_PASSCODE_LENGTH = 8;

/**
 * The configured passcode, or null if it's missing or too short -- in which
 * case editing stays locked for everyone rather than falling open.
 */
export function usablePasscode(raw: string | undefined): string | null {
  const passcode = raw?.trim();
  return passcode && passcode.length >= MIN_PASSCODE_LENGTH ? passcode : null;
}

export function passcodeMatches(attempt: string, passcode: string): boolean {
  // Hash both sides first so timingSafeEqual gets equal-length input and the
  // time taken doesn't reveal how much of the passcode was right.
  const attemptHash = createHash("sha256").update(attempt.trim()).digest();
  const passcodeHash = createHash("sha256").update(passcode).digest();
  return timingSafeEqual(attemptHash, passcodeHash);
}

let cachedKey: { passcode: string; key: Buffer } | null = null;

function signingKey(passcode: string): Buffer {
  if (cachedKey?.passcode !== passcode) {
    // Sessions are signed with a key derived from the passcode itself, so
    // changing the passcode signs every device out. scrypt makes that key
    // slow to derive, so a copied cookie can't be used to guess the passcode
    // offline at any useful speed.
    cachedKey = { passcode, key: scryptSync(passcode, "pool-league-tracker:editor-session:v1", 32) };
  }
  return cachedKey.key;
}

function signature(issuedAt: number, passcode: string): string {
  return createHmac("sha256", signingKey(passcode)).update(`editor:${issuedAt}`).digest("base64url");
}

/** Cookie value proving this device entered the passcode at `now`. */
export function createEditorToken(passcode: string, now = Date.now()): string {
  return `${now}.${signature(now, passcode)}`;
}

export function verifyEditorToken(
  token: string | undefined,
  passcode: string | null,
  now = Date.now()
): boolean {
  if (!token || !passcode) return false;

  const parts = token.split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !parts[1]) return false;
  const issuedAt = Number(parts[0]);

  // The expiry is checked here, not just left to the cookie's max-age, since
  // a cookie's expiry is whatever the browser sending it says it is. A minute
  // of slack covers clock differences between servers.
  const age = now - issuedAt;
  if (age < -60_000 || age > SESSION_MAX_AGE_SECONDS * 1000) return false;

  const expected = Buffer.from(signature(issuedAt, passcode));
  const actual = Buffer.from(parts[1]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Where to send someone after signing in. Only paths on this same site are
 * allowed, so a crafted sign-in link can't bounce someone to another website.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";

  // Let the URL parser decide, since browsers treat things like `//host`,
  // `/\host`, and stray tabs as another site -- a hand-rolled check misses those.
  const base = "http://same-site.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return "/";
  }
  if (url.origin !== base) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
