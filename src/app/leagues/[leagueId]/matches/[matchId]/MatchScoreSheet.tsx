import { amountOverCap, calculateRoundScore, isRoundPlayed } from "@/lib/scoring";
import type { CardView } from "./card-view";
import RoundSheet, { type RoundSummary } from "./RoundSheet";

// The match's score sheet, laid out like the league's paper "Bonus Score
// Sheet": one block per round, each side's players with handicap, both
// games and totals, then the round's summary and WIN/LOSS.
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
  const summaries: RoundSummary[] = rounds.map((round) => {
    const scores = round.cards.map((c) => c.scores);
    const homeHandicapTotal = round.cards.reduce((sum, c) => sum + c.homeHandicap, 0);
    const awayHandicapTotal = round.cards.reduce((sum, c) => sum + c.awayHandicap, 0);
    const score = calculateRoundScore(scores, homeHandicapTotal, awayHandicapTotal);
    const homeOver = amountOverCap(homeHandicapTotal);
    const awayOver = amountOverCap(awayHandicapTotal);
    const difference = Math.round(Math.abs(homeOver - awayOver) * 10) / 10;
    return {
      played: isRoundPlayed(scores),
      homeSubtotal: score.home.scoreSubtotal,
      awaySubtotal: score.away.scoreSubtotal,
      homeHandicapTotal,
      awayHandicapTotal,
      homeOver,
      awayOver,
      difference,
      doubled: Math.round(difference * 2 * 10) / 10,
      rounded: Math.round(difference * 2),
      homeBonus: score.home.bonus,
      awayBonus: score.away.bonus,
      homeTotal: score.home.roundTotal,
      awayTotal: score.away.roundTotal,
    };
  });

  // Rounds nobody has scored yet don't count toward the match total, or the
  // handicap bonus alone would put points on the board before anyone plays.
  const played = summaries.filter((s) => s.played);
  const matchHomeTotal = played.reduce((sum, s) => sum + s.homeTotal, 0);
  const matchAwayTotal = played.reduce((sum, s) => sum + s.awayTotal, 0);

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

      <p className="text-sm text-neutral-500">
        Tap a row to enter or check that table&apos;s scores.
      </p>

      {rounds.map((round, i) => (
        <RoundSheet
          key={round.id}
          leagueId={leagueId}
          matchId={matchId}
          isManager={isManager}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          roundNumber={round.roundNumber}
          cards={round.cards}
          summary={summaries[i]}
        />
      ))}

      <div className="flex flex-col gap-1 text-xs text-neutral-500">
        <p>
          1. ERO depicted by a circle around the winning player&apos;s score. To qualify as an ERO,
          it must be your first attempt at the table and no balls have been pocketed.
        </p>
        <p>
          2. A tied round shall count as half of a point for both teams and depicted by circling
          the round total score.
        </p>
        <p className="text-neutral-400">
          A green dot means both players confirmed a table; amber means it&apos;s waiting on the
          other player.
        </p>
      </div>
    </div>
  );
}
