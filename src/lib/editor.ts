import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createEditorToken,
  EDITOR_COOKIE,
  safeNextPath,
  SESSION_MAX_AGE_SECONDS,
  usablePasscode,
  verifyEditorToken,
} from "@/lib/editor-token";
import { getCurrentUser } from "@/lib/session";

// Site admins can see and manage every league. That's anyone signed in with
// Google as a listed admin (see src/lib/admins.ts), or, until the passcode is
// retired, a device that entered the shared editor passcode (EDITOR_PASSCODE)
// on /login. Everyone else gets access league by league: see src/lib/access.ts.

export function editorPasscode(): string | null {
  return usablePasscode(process.env.EDITOR_PASSCODE);
}

/** Whether this request comes from a site admin. */
export const isSiteAdmin = cache(async (): Promise<boolean> => {
  if ((await getCurrentUser())?.isAdmin) return true;
  const token = (await cookies()).get(EDITOR_COOKIE)?.value;
  return verifyEditorToken(token, editorPasscode());
});

/**
 * Sends the visitor to sign in, then back to `returnTo`, or, if that isn't
 * given (e.g. from a server action), back to the page they were on.
 */
export async function redirectToLogin(returnTo?: string): Promise<never> {
  let path = returnTo;
  if (!path) {
    const referer = (await headers()).get("referer");
    try {
      const url = new URL(referer ?? "");
      path = `${url.pathname}${url.search}`;
    } catch {
      path = "/";
    }
  }
  redirect(`/login?next=${encodeURIComponent(safeNextPath(path))}`);
}

export async function startEditorSession(passcode: string) {
  (await cookies()).set(EDITOR_COOKIE, createEditorToken(passcode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endEditorSession() {
  (await cookies()).delete(EDITOR_COOKIE);
}
