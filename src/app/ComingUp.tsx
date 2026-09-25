import Link from "next/link";

// "Coming up" on the home page: the matches in your leagues that still have
// something left to do, with your own table called out. Which matches make
// the list is decided by matchAhead() in src/lib/upcoming-matches.ts.

export interface ComingUpMatch {
  id: string;
  leagueId: string;
  leagueName: string;
  homeTeamName: string;
  awayTeamName: string;
  date: string;
  playing: boolean;
  tableNumber: number | null;
  roundsToPlay: number;
  cardsToConfirm: number;
  started: boolean;
  scheduledAhead: boolean;
  /** Whether the viewer is in more than one league, so the name is worth showing. */
  showLeagueName: boolean;
}

function formatDate(date: string) {
  // Match dates are stored as midnight UTC, so read them back in UTC or the
  // weekday slides a day for anyone west of it.
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function ComingUp({ matches }: { matches: ComingUpMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Coming up</h2>
        <p className="text-sm text-neutral-500">
          Matches to play, and ones still waiting on scores.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {matches.map((match) => (
          <li key={match.id}>
            <Link
              href={`/leagues/${match.leagueId}/matches/${match.id}`}
              className="flex flex-col gap-1 rounded-lg border p-4 hover:bg-neutral-50"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">
                  {match.homeTeamName} vs {match.awayTeamName}
                </span>
                <span className="shrink-0 text-sm text-neutral-500">{formatDate(match.date)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                {match.showLeagueName && <span className="truncate">{match.leagueName}</span>}
                {match.playing && (
                  <span className="text-neutral-700">
                    {match.tableNumber === null
                      ? "You're playing"
                      : `You're on table ${match.tableNumber}`}
                  </span>
                )}
                {match.cardsToConfirm > 0 && (
                  <Badge tone="amber">
                    Confirm {match.cardsToConfirm} card{match.cardsToConfirm === 1 ? "" : "s"}
                  </Badge>
                )}
                {match.roundsToPlay > 0 &&
                  (match.started ? (
                    <Badge tone="neutral">
                      {match.roundsToPlay} round{match.roundsToPlay === 1 ? "" : "s"} left
                    </Badge>
                  ) : (
                    // A match that's been and gone with nothing entered: say so,
                    // or it looks like it's listed for no reason.
                    !match.scheduledAhead && <Badge tone="neutral">No scores yet</Badge>
                  ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Badge({ tone, children }: { tone: "amber" | "neutral"; children: React.ReactNode }) {
  const colors =
    tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors}`}>{children}</span>;
}
