import { setMatchHandicaps } from "@/lib/score-actions";

// Handicaps are checked at the start of every match. Each match keeps its own
// copy, so correcting someone's handicap later never rewrites a match that's
// already been played.
export default function MatchHandicaps({
  leagueId,
  matchId,
  homeTeamName,
  awayTeamName,
  home,
  away,
  anyScores,
}: {
  leagueId: string;
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  home: { id: string; name: string; handicap: number }[];
  away: { id: string; name: string; handicap: number }[];
  /** Once scores are in, the panel starts collapsed. */
  anyScores: boolean;
}) {
  const sides = [
    { title: homeTeamName, players: home },
    { title: awayTeamName, players: away },
  ];

  return (
    <details className="rounded-lg border p-4" open={!anyScores}>
      <summary className="cursor-pointer font-semibold">Handicaps for this match</summary>
      <p className="mt-2 text-sm text-neutral-500">
        Check these before the first break. They&apos;re this match&apos;s own copy: changing them
        here leaves matches already played alone, and sets each player&apos;s handicap for next
        time.
      </p>
      <form
        action={setMatchHandicaps.bind(null, leagueId, matchId)}
        className="mt-3 flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {sides.map((side) => (
            <div key={side.title} className="flex flex-col gap-2">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {side.title}
              </div>
              {side.players.map((player) => (
                <label key={player.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{player.name}</span>
                  <input
                    type="number"
                    name={`handicap_${player.id}`}
                    defaultValue={player.handicap}
                    step="0.1"
                    min="0"
                    max="20"
                    className="w-20 shrink-0 rounded-md border px-2 py-1 text-right"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
        <button
          type="submit"
          className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Save handicaps
        </button>
      </form>
    </details>
  );
}
