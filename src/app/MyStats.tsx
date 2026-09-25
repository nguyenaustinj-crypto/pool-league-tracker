import Link from "next/link";
import type { PlayerStats } from "@/lib/player-stats";

// "Your record" on the home page: how the signed-in player is doing, read
// off their own score cards (src/lib/player-stats.ts). One card per league
// they've picked a roster name in.

export interface MyStatsLeague {
  leagueId: string;
  leagueName: string;
  playerName: string;
  teamName: string;
  handicap: number;
  stats: PlayerStats;
}

export default function MyStats({
  leagues,
  unclaimed,
}: {
  leagues: MyStatsLeague[];
  /** Leagues where they haven't said which player they are yet. */
  unclaimed: { leagueId: string; leagueName: string }[];
}) {
  if (leagues.length === 0 && unclaimed.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Your record</h2>
        <p className="text-sm text-neutral-500">
          Your own games, points and EROs, counted from the score sheets.
        </p>
      </div>

      {leagues.map((league) => (
        <div key={league.leagueId} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Link href={`/leagues/${league.leagueId}`} className="font-medium hover:underline">
              {league.leagueName}
            </Link>
            <span className="text-sm text-neutral-500">
              {league.playerName} · {league.teamName} · handicap {league.handicap}
            </span>
          </div>

          {league.stats.gamesPlayed === 0 ? (
            <p className="text-sm text-neutral-600">
              No games yet. Your record shows up here once your first scores are in.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Games W–L"
                  value={`${league.stats.gamesWon}–${league.stats.gamesLost}`}
                />
                <Stat label="Win rate" value={`${league.stats.winPercent}%`} />
                <Stat label="Points" value={league.stats.points} />
                <Stat label="EROs" value={league.stats.eros} />
              </div>
              <p className="text-xs text-neutral-500">
                {league.stats.matchesPlayed} match
                {league.stats.matchesPlayed === 1 ? "" : "es"} · {league.stats.pointsPerGame} points
                a game
              </p>
            </>
          )}
        </div>
      ))}

      {unclaimed.map((league) => (
        <Link
          key={league.leagueId}
          href={`/leagues/${league.leagueId}`}
          className="rounded-lg border border-dashed p-4 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Tell {league.leagueName} which player you are to see your record.
        </Link>
      ))}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-neutral-50 p-3">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
