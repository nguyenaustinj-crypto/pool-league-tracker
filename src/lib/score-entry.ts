// The rules for entering one score card (one table in one round: a home
// player against an away player, two games). Pure, so they're unit-tested
// directly (score-entry.test.ts), and shared by the tap-entry UI and the
// server actions that save it.
//
// Scoring, per the league rules and the real paper sheet: each player has 7
// balls worth 1 point each, and the 8-ball is worth 3. Sinking the 8 wins, so
// the winner always gets exactly 10; pocketing it early loses, so the loser
// gets 0-7 (8 and 9 can't happen). An ERO is a game won on the winner's first
// turn at the table, before any balls were pocketed; it's marked, not scored.
// A forfeit (manager-only) gives the missing player their handicap, capped at
// 7, and the other player 10.

export type Side = "home" | "away";

export interface GameEntry {
  winner: Side;
  /** The loser's points: balls pocketed (0-7), or their handicap on a forfeit. */
  loserPoints: number;
  ero: boolean;
  forfeit: boolean;
}

/**
 * A card's stored scores, in the database's shape. (A type rather than an
 * interface so it can be saved as JSON in the edit history.)
 */
export type CardScores = {
  homeGame1: number;
  homeGame2: number;
  awayGame1: number;
  awayGame2: number;
  homeGame1Ero: boolean;
  homeGame2Ero: boolean;
  awayGame1Ero: boolean;
  awayGame2Ero: boolean;
};

export function cardScoresOf(card: CardScores): CardScores {
  return {
    homeGame1: card.homeGame1,
    homeGame2: card.homeGame2,
    awayGame1: card.awayGame1,
    awayGame2: card.awayGame2,
    homeGame1Ero: card.homeGame1Ero,
    homeGame2Ero: card.homeGame2Ero,
    awayGame1Ero: card.awayGame1Ero,
    awayGame2Ero: card.awayGame2Ero,
  };
}

export type CardStatus = "EMPTY" | "ENTERED" | "CONFIRMED";

export const WIN_POINTS = 10;
export const MAX_LOSER_BALLS = 7;
export const MAX_FORFEIT_POINTS = 7;

/** A forfeiting player's points: their handicap (to one decimal), capped at 7. */
export function forfeitPoints(handicap: number): number {
  return Math.min(Math.max(0, Math.round(handicap * 10) / 10), MAX_FORFEIT_POINTS);
}

/** Why a game can't be saved, or null if it's fine. */
export function validateGame(
  game: GameEntry,
  { loserHandicap, isManager }: { loserHandicap: number; isManager: boolean }
): string | null {
  if (game.winner !== "home" && game.winner !== "away") return "Pick who won each game.";
  if (game.forfeit) {
    if (!isManager) return "Only a league manager can record a forfeit.";
    if (game.ero) return "A forfeit can't be an ERO.";
    if (game.loserPoints !== forfeitPoints(loserHandicap)) {
      return "On a forfeit, the missing player gets their handicap, up to 7.";
    }
    return null;
  }
  if (
    !Number.isInteger(game.loserPoints) ||
    game.loserPoints < 0 ||
    game.loserPoints > MAX_LOSER_BALLS
  ) {
    return "The loser's score is the balls they pocketed: 0 to 7.";
  }
  return null;
}

/** Turns a checked-over entry into the scores stored on the card. */
export function gamesToScores(game1: GameEntry, game2: GameEntry): CardScores {
  const side = (game: GameEntry, s: Side) =>
    game.winner === s ? WIN_POINTS : game.loserPoints;
  const ero = (game: GameEntry, s: Side) => game.winner === s && game.ero;
  return {
    homeGame1: side(game1, "home"),
    homeGame2: side(game2, "home"),
    awayGame1: side(game1, "away"),
    awayGame2: side(game2, "away"),
    homeGame1Ero: ero(game1, "home"),
    homeGame2Ero: ero(game2, "home"),
    awayGame1Ero: ero(game1, "away"),
    awayGame2Ero: ero(game2, "away"),
  };
}

/**
 * Reads a stored game back into an entry, to pre-fill the editor. Null for
 * a game that hasn't been entered, or that doesn't follow the rules (e.g. a
 * score typed in before tap entry existed), so it starts blank.
 */
export function scoresToGame(
  home: number,
  away: number,
  homeEro: boolean,
  awayEro: boolean
): GameEntry | null {
  if (home === WIN_POINTS && away !== WIN_POINTS && away >= 0 && away <= MAX_FORFEIT_POINTS) {
    return { winner: "home", loserPoints: away, ero: homeEro, forfeit: !Number.isInteger(away) };
  }
  if (away === WIN_POINTS && home !== WIN_POINTS && home >= 0 && home <= MAX_FORFEIT_POINTS) {
    return { winner: "away", loserPoints: home, ero: awayEro, forfeit: !Number.isInteger(home) };
  }
  return null;
}

/**
 * Checks untrusted input (it arrives from the browser) is shaped like two
 * game entries. Doesn't check the scoring rules; validateGame does that.
 */
export function parseCardInput(raw: unknown): { version: number; games: [GameEntry, GameEntry] } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { version, games } = raw as { version?: unknown; games?: unknown };
  if (!Number.isInteger(version) || !Array.isArray(games) || games.length !== 2) return null;
  const parsed = games.map((g): GameEntry | null => {
    if (typeof g !== "object" || g === null) return null;
    const { winner, loserPoints, ero, forfeit } = g as Record<string, unknown>;
    if (winner !== "home" && winner !== "away") return null;
    if (typeof loserPoints !== "number" || !Number.isFinite(loserPoints)) return null;
    if (typeof ero !== "boolean" || typeof forfeit !== "boolean") return null;
    return { winner, loserPoints, ero, forfeit };
  });
  if (!parsed[0] || !parsed[1]) return null;
  return { version: version as number, games: [parsed[0], parsed[1]] };
}

/** Who may change a card's scores: a manager any time; its two players until the match is locked. */
export function canEditCard({
  isManager,
  viewerUserId,
  homeUserId,
  awayUserId,
  locked,
}: {
  isManager: boolean;
  viewerUserId: string | null;
  homeUserId: string | null;
  awayUserId: string | null;
  locked: boolean;
}): boolean {
  if (isManager) return true;
  if (locked || !viewerUserId) return false;
  return viewerUserId === homeUserId || viewerUserId === awayUserId;
}

/** Who may confirm a card: the other player at the table, or a manager. Never the person who entered it. */
export function canConfirmCard({
  isManager,
  viewerUserId,
  homeUserId,
  awayUserId,
  locked,
  status,
  enteredById,
}: {
  isManager: boolean;
  viewerUserId: string | null;
  homeUserId: string | null;
  awayUserId: string | null;
  locked: boolean;
  status: CardStatus;
  enteredById: string | null;
}): boolean {
  if (status !== "ENTERED") return false;
  if (isManager) return true;
  if (locked || !viewerUserId || viewerUserId === enteredById) return false;
  return viewerUserId === homeUserId || viewerUserId === awayUserId;
}

/** A manager's entry is final; a player's waits for the other player to confirm. */
export function statusAfterSave(isManager: boolean): "ENTERED" | "CONFIRMED" {
  return isManager ? "CONFIRMED" : "ENTERED";
}

/** A card's scores as short text for the history, e.g. "10–4, 6–10". */
export function formatCardScores(s: CardScores): string {
  const game = (h: number, a: number, he: boolean, ae: boolean) =>
    h === 0 && a === 0 ? "—" : `${h}${he ? "*" : ""}–${a}${ae ? "*" : ""}`;
  return `${game(s.homeGame1, s.awayGame1, s.homeGame1Ero, s.awayGame1Ero)}, ${game(
    s.homeGame2,
    s.awayGame2,
    s.homeGame2Ero,
    s.awayGame2Ero
  )}`;
}
