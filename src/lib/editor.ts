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

// Anyone can view the site. Adding or changing anything requires the shared
// editor passcode (EDITOR_PASSCODE), entered once per device on /login.

export function editorPasscode(): string | null {
  return usablePasscode(process.env.EDITOR_PASSCODE);
}

/** Whether this request comes from a device that has entered the passcode. */
export const isEditor = cache(async (): Promise<boolean> => {
  const token = (await cookies()).get(EDITOR_COOKIE)?.value;
  return verifyEditorToken(token, editorPasscode());
});

function loginPath(returnTo: string) {
  return `/login?next=${encodeURIComponent(safeNextPath(returnTo))}`;
}

/** For edit-only pages: send viewers to sign in, then back to this page. */
export async function requireEditorPage(returnTo: string) {
  if (!(await isEditor())) redirect(loginPath(returnTo));
}

/**
 * Must be the first thing every data-changing server action does. Server
 * actions can be called with a direct POST request, so hiding the edit
 * buttons from viewers isn't enough on its own.
 */
export async function requireEditor() {
  if (await isEditor()) return;

  // Send them back to the page they were on once they've signed in.
  let returnTo = "/";
  const referer = (await headers()).get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      returnTo = `${url.pathname}${url.search}`;
    } catch {
      returnTo = "/";
    }
  }
  redirect(loginPath(returnTo));
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
