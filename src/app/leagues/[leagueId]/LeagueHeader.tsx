import Link from "next/link";

export default function LeagueHeader({
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {
  return (
    <div>
      <p className="text-sm text-neutral-500">
        <Link href="/" className="underline">
          Leagues
        </Link>
      </p>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{leagueName}</h1>
        <Link href={`/leagues/${leagueId}/edit`} className="text-sm text-neutral-500 underline">
          Edit League
        </Link>
      </div>
    </div>
  );
}
