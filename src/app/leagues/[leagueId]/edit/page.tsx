import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueManagerPage } from "@/lib/access";
import { updateLeague, deleteLeague } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import DeleteConfirmForm from "./DeleteConfirmForm";

export default async function EditLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const access = await requireLeagueManagerPage(leagueId, `/leagues/${leagueId}/edit`);

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const updateThisLeague = updateLeague.bind(null, league.id);
  const deleteThisLeague = deleteLeague.bind(null, league.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/" className="underline">
            My leagues
          </Link>{" "}
          /{" "}
          <Link href={`/leagues/${league.id}`} className="underline">
            {league.name}
          </Link>
        </p>
        <h1 className="text-xl font-bold">Edit League</h1>
      </div>

      <form action={updateThisLeague} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row">
        <input
          type="text"
          name="name"
          defaultValue={league.name}
          required
          className="flex-1 rounded-md border px-3 py-2"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Save
        </button>
      </form>

      {access.canDelete ? (
        <section className="flex flex-col gap-3 rounded-lg border border-red-300 p-4">
          <h2 className="font-semibold text-red-700">Delete this league</h2>
          <p className="text-sm text-neutral-600">
            This permanently deletes {league.name}, every player in it, and every match ever
            recorded for it. There&apos;s no undo. Type the league&apos;s name to confirm.
          </p>
          <DeleteConfirmForm action={deleteThisLeague} expectedName={league.name} />
        </section>
      ) : (
        <p className="text-sm text-neutral-500">
          Deleting a league wipes every match ever recorded for it, so only site admins can do
          it.
        </p>
      )}
    </div>
  );
}
