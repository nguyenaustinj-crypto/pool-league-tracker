import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="text-neutral-600">
        That league, team, or match doesn&apos;t exist — it may have been deleted.
      </p>
      <Link
        href="/"
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        Back to leagues
      </Link>
    </div>
  );
}
