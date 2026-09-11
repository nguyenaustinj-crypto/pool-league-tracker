"use server";

import { redirect } from "next/navigation";
import { editorPasscode, endEditorSession, startEditorSession } from "@/lib/editor";
import { passcodeMatches, safeNextPath } from "@/lib/editor-token";

export interface SignInState {
  error: string | null;
}

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

export async function signOut() {
  await endEditorSession();
  redirect("/");
}
