"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-neutral-600">
        That action didn&apos;t go through. Nothing was saved, so it&apos;s safe to try again.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Back to leagues
        </Link>
      </div>
      {error.digest && (
        // Next.js strips server error messages in production and leaves only
        // this digest, which matches an entry in the Vercel runtime logs --
        // so it's the one thing worth showing when reporting a problem.
        <p className="text-xs text-neutral-400">Reference: {error.digest}</p>
      )}
    </div>
  );
}
