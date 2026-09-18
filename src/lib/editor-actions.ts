"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { editorPasscode, endEditorSession, startEditorSession } from "@/lib/editor";
import { passcodeMatches, safeNextPath } from "@/lib/editor-token";
import { getCurrentUser } from "@/lib/session";

export interface SignInState {
  error: string | null;
}

/** Signs in with the shared editor passcode (the fallback until it's retired). */
export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const passcode = editorPasscode();
  if (!passcode) {
    return { error: "Editing is switched off: this site doesn't have an editor passcode set up." };
  }

  const attempt = String(formData.get("passcode") ?? "");
  if (!passcodeMatches(attempt, passcode)) {
    // Makes guessing the passcode slow.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { error: "That passcode isn't right." };
  }

  await startEditorSession(passcode);
  redirect(safeNextPath(formData.get("next")));
}

/** Signs this device out of everything: Google sign-in and the editor passcode. */
export async function signOut() {
  const auth = getAuth();
  if (auth && (await getCurrentUser())) {
    await auth.api.signOut({ headers: await headers() });
  }
  await endEditorSession();
  redirect("/");
}
