import type { Metadata } from "next";
import Link from "next/link";
import { editorPasscode, isEditor } from "@/lib/editor";
import { signOut } from "@/lib/editor-actions";
import { safeNextPath } from "@/lib/editor-token";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Editor sign in · Pool League Tracker",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const returnTo = safeNextPath(next);

  if (await isEditor()) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">You&apos;re signed in</h1>
        <p className="text-neutral-600">
          This device can add and change leagues, teams, players, and scores.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={returnTo}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Continue
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Editor sign in</h1>
      <p className="text-neutral-600">
        Anyone can view standings and scores. To add or change anything, enter the league&apos;s
        editor passcode. This device then stays signed in for 30 days.
      </p>
      {editorPasscode() ? (
        <LoginForm next={returnTo} />
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Editing is switched off right now: no editor passcode has been set up for this site yet.
        </p>
      )}
    </div>
  );
}
