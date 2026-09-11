"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/editor-actions";

const initialState: SignInState = { error: null };

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Editor passcode
        <input
          type="password"
          name="passcode"
          required
          autoComplete="current-password"
          className="rounded-md border px-3 py-2 font-normal"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
