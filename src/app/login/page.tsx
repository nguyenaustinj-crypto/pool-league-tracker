import type { Metadata } from "next";
import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { signInConfigured } from "@/lib/auth";
import { editorPasscode, isSiteAdmin } from "@/lib/editor";
import { signOut } from "@/lib/editor-actions";
import { safeNextPath } from "@/lib/editor-token";
import { getCurrentUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Pool League Tracker",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const returnTo = safeNextPath(next);
  const [user, siteAdmin] = await Promise.all([getCurrentUser(), isSiteAdmin()]);

  if (user || siteAdmin) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">You&apos;re signed in</h1>
        <p className="text-neutral-600">
          {user ? (
            <>
              Signed in as <span className="font-medium">{user.name}</span> ({user.email}).
            </>
          ) : (
            "Signed in with the editor passcode, as a site admin."
          )}
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
      <h1 className="text-xl font-bold">Sign in</h1>
      <p className="text-neutral-600">
        Sign in to see your leagues, find new ones, and ask to join.
      </p>

      {error === "google" && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Google sign-in didn&apos;t finish. Please try again.
        </p>
      )}

      {signInConfigured() ? (
        <div className="sm:max-w-xs">
          <GoogleSignInButton next={returnTo} />
        </div>
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Google sign-in isn&apos;t set up on this site yet.
        </p>
      )}

      {editorPasscode() && (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Use the editor passcode instead
          </summary>
          <div className="mt-3">
            <LoginForm next={returnTo} />
          </div>
        </details>
      )}
    </div>
  );
}
