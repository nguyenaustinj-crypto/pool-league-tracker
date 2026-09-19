import { amountOverCap, calculateRoundScore, HANDICAP_CAP, isRoundPlayed } from "@/lib/scoring";
import ScoreCard, { type CardView } from "./ScoreCard";

// The match's score sheet: running totals, and one card per table per round.
// Each card saves on its own (ScoreCard), so two tables entering scores at
// the same time never overwrite each other.
export default function MatchScoreSheet({
  leagueId,
  matchId,
  homeTeamName,
  awayTeamName,
  rounds,
  isManager,
}: {
  leagueId: string;
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  rounds: { id: string; roundNumber: number; cards: CardView[] }[];
  isManager: boolean;
}) {
  const roundScores = rounds.map((round) => {
    const homeHandicapTotal = round.cards.reduce((sum, c) => sum + c.homeHandicap, 0);
    const awayHandicapTotal = round.cards.reduce((sum, c) => sum + c.awayHandicap, 0);
    const scores = round.cards.map((c) => c.scores);
    return {
      ...calculateRoundScore(scores, homeHandicapTotal, awayHandicapTotal),
      played: isRoundPlayed(scores),
    };
  });

  // Rounds nobody has scored yet don't count toward the match total, or the
  // handicap bonus alone would put points on the board before anyone plays.
  const playedRounds = roundScores.filter((r) => r.played);
  const matchHomeTotal = playedRounds.reduce((sum, r) => sum + r.home.roundTotal, 0);
  const matchAwayTotal = playedRounds.reduce((sum, r) => sum + r.away.roundTotal, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-lg border bg-neutral-50 p-4">
        <div className="font-medium">
          {homeTeamName} vs {awayTeamName}
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {matchHomeTotal} – {matchAwayTotal}
        </div>
      </div>

      {rounds.map((round, i) => {
        const score = roundScores[i];
        return (
          <div key={round.id} className="flex flex-col gap-3 rounded-lg border p-4">
            <h2 className="font-semibold">Round {round.roundNumber}</h2>
            <div className="flex flex-col gap-2">
              {round.cards.map((card) => (
                <ScoreCard
                  key={`${card.id}:${card.version}`}
                  card={card}
                  leagueId={leagueId}
                  matchId={matchId}
                  isManager={isManager}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 border-t pt-3 text-sm">
              <RoundSummary label={homeTeamName} team={score.home} played={score.played} />
              <RoundSummary label={awayTeamName} team={score.away} played={score.played} />
            </div>
          </div>
        );
      })}

      <p className="text-xs text-neutral-500">
        After both games at your table, tap <span className="font-medium">Enter score</span>; the
        other player confirms it. A circled score is an ERO.
      </p>
    </div>
  );
}

function RoundSummary({
  label,
  team,
  played,
}: {
  label: string;
  team: ReturnType<typeof calculateRoundScore>["home"];
  played: boolean;
}) {
  const overCap = amountOverCap(team.handicapTotal);

  return (
    <div>
      <div className="font-medium">{label}</div>
      <div className="text-neutral-500">Score subtotal: {team.scoreSubtotal}</div>
      <div className="text-neutral-500">
        {/* Summed handicaps are floats; one decimal matches how handicaps are kept. */}
        Handicap total: {team.handicapTotal.toFixed(1)}
        {overCap > 0 && (
          <span className="text-neutral-400">
            {" "}
            ({overCap.toFixed(1)} over {HANDICAP_CAP})
          </span>
        )}
      </div>
      {played ? (
        <>
          <div className="text-neutral-500">Bonus: {team.bonus}</div>
          <div className="font-semibold">Round total: {team.roundTotal}</div>
        </>
      ) : (
        <div className="text-neutral-400">Not scored yet</div>
      )}
    </div>
  );
}
