import { calculateRoundScore, isRoundPlayed, type PairingScore } from "@/lib/scoring";

// Standings are based on ROUND wins, not match wins -- per the league's own
// rule #12 ("the team with the most round wins at the end of the season
// will be the league champion"), each of a match's N rounds is its own
// win/loss/tie, not just one outcome per match. A tied round counts as half
// a point for both teams, per the paper sheet's footnote #2.
export interface TeamStanding {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  points: number;
}

interface RoundForStandings {
  pairings: (PairingScore & {
    homePlayer: { rating: number };
    awayPlayer: { rating: number };
  })[];
}

interface MatchForStandings {
  homeTeamId: string;
  awayTeamId: string;
  rounds: RoundForStandings[];
}

export function calculateStandings(
  teams: { id: string; name: string }[],
  matches: MatchForStandings[]
): TeamStanding[] {
  const table = new Map<string, TeamStanding>(
    teams.map((team) => [
      team.id,
      { teamId: team.id, teamName: team.name, wins: 0, losses: 0, ties: 0, points: 0 },
    ])
  );

  for (const match of matches) {
    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);
    if (!home || !away) continue;

    for (const round of match.rounds) {
      // A round nobody has scored yet isn't a result. Counting it would make
      // every unplayed round a tie, or a win for whichever side the handicap
      // bonus favors.
      if (!isRoundPlayed(round.pairings)) continue;

      const homeHandicapTotal = round.pairings.reduce((sum, p) => sum + p.homePlayer.rating, 0);
      const awayHandicapTotal = round.pairings.reduce((sum, p) => sum + p.awayPlayer.rating, 0);
      const score = calculateRoundScore(round.pairings, homeHandicapTotal, awayHandicapTotal);

      home.points += score.home.roundTotal;
      away.points += score.away.roundTotal;

      if (score.home.roundTotal === score.away.roundTotal) {
        home.wins += 0.5;
        away.wins += 0.5;
        home.losses += 0.5;
        away.losses += 0.5;
        home.ties += 1;
        away.ties += 1;
      } else if (score.home.roundTotal > score.away.roundTotal) {
        home.wins += 1;
        away.losses += 1;
      } else {
        away.wins += 1;
        home.losses += 1;
      }
    }
  }

  return [...table.values()].sort((a, b) => b.wins - a.wins || b.points - a.points);
}
