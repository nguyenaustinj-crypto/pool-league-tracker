import { describe, it, expect } from "vitest";
import {
  canConfirmCard,
  canEditCard,
  forfeitPoints,
  formatCardScores,
  gamesToScores,
  parseCardInput,
  scoresToGame,
  statusAfterSave,
  validateGame,
  type GameEntry,
} from "@/lib/score-entry";

/**
 * Players now enter their own scores, so these rules are what stand between a
 * mistyped score (or a player trying to change someone else's table) and the
 * standings.
 */

const win = (winner: "home" | "away", loserPoints: number, ero = false): GameEntry => ({
  winner,
  loserPoints,
  ero,
  forfeit: false,
});

describe("validateGame", () => {
  const player = { loserHandicap: 6.2, isManager: false };

  it("accepts a normal game: winner 10, loser 0-7", () => {
    for (let balls = 0; balls <= 7; balls++) {
      expect(validateGame(win("home", balls), player)).toBeNull();
    }
    expect(validateGame(win("away", 4, true), player)).toBeNull();
  });

  it("rejects loser scores the game can't produce", () => {
    for (const bad of [8, 9, 10, -1, 3.5, Number.NaN]) {
      expect(validateGame(win("home", bad), player)).not.toBeNull();
    }
  });

  it("only lets managers record a forfeit, at the missing player's handicap capped at 7", () => {
    const forfeit = { winner: "home" as const, loserPoints: 6.2, ero: false, forfeit: true };
    expect(validateGame(forfeit, player)).toMatch(/manager/);
    expect(validateGame(forfeit, { loserHandicap: 6.2, isManager: true })).toBeNull();
    expect(
      validateGame({ ...forfeit, loserPoints: 7 }, { loserHandicap: 8.5, isManager: true })
    ).toBeNull();
    expect(
      validateGame({ ...forfeit, loserPoints: 5 }, { loserHandicap: 6.2, isManager: true })
    ).not.toBeNull();
    expect(
      validateGame({ ...forfeit, ero: true }, { loserHandicap: 6.2, isManager: true })
    ).not.toBeNull();
  });
});

describe("forfeitPoints", () => {
  it("is the handicap, to one decimal, capped at 7", () => {
    expect(forfeitPoints(6.2)).toBe(6.2);
    expect(forfeitPoints(8.5)).toBe(7);
    expect(forfeitPoints(7)).toBe(7);
    expect(forfeitPoints(0)).toBe(0);
  });
});

describe("gamesToScores / scoresToGame", () => {
  it("stores the winner as 10 and marks an ERO only on the winner", () => {
    expect(gamesToScores(win("home", 4, true), win("away", 6))).toEqual({
      homeGame1: 10,
      awayGame1: 4,
      homeGame2: 6,
      awayGame2: 10,
      homeGame1Ero: true,
      awayGame1Ero: false,
      homeGame2Ero: false,
      awayGame2Ero: false,
    });
  });

  it("reads stored games back, so the editor starts from what's saved", () => {
    expect(scoresToGame(10, 4, true, false)).toEqual(win("home", 4, true));
    expect(scoresToGame(6, 10, false, false)).toEqual(win("away", 6));
    expect(scoresToGame(10, 6.2, false, false)).toEqual({
      winner: "home",
      loserPoints: 6.2,
      ero: false,
      forfeit: true,
    });
  });

  it("starts blank for games not entered, or typed in before the rules were enforced", () => {
    expect(scoresToGame(0, 0, false, false)).toBeNull();
    expect(scoresToGame(6, 4, false, false)).toBeNull();
    expect(scoresToGame(10, 10, false, false)).toBeNull();
  });
});

describe("parseCardInput", () => {
  it("accepts two well-formed games and a version", () => {
    const input = { version: 3, games: [win("home", 4), win("away", 0)] };
    expect(parseCardInput(input)).toEqual(input);
  });

  it("rejects anything else the browser might send", () => {
    for (const junk of [
      null,
      "scores",
      { version: 1 },
      { version: "1", games: [win("home", 4), win("away", 0)] },
      { version: 1, games: [win("home", 4)] },
      { version: 1, games: [win("home", 4), { winner: "nobody", loserPoints: 1, ero: false, forfeit: false }] },
      { version: 1, games: [win("home", 4), { winner: "home", loserPoints: "7", ero: false, forfeit: false }] },
    ]) {
      expect(parseCardInput(junk)).toBeNull();
    }
  });
});

describe("who can change a card", () => {
  const card = { homeUserId: "home-player", awayUserId: "away-player" };

  it("lets either player at the table enter it until the match is locked", () => {
    expect(canEditCard({ ...card, isManager: false, viewerUserId: "home-player", locked: false })).toBe(true);
    expect(canEditCard({ ...card, isManager: false, viewerUserId: "away-player", locked: false })).toBe(true);
    expect(canEditCard({ ...card, isManager: false, viewerUserId: "home-player", locked: true })).toBe(false);
  });

  it("never lets another player, or a signed-out viewer, change it", () => {
    expect(canEditCard({ ...card, isManager: false, viewerUserId: "someone-else", locked: false })).toBe(false);
    expect(canEditCard({ ...card, isManager: false, viewerUserId: null, locked: false })).toBe(false);
    // A roster name without an account can't be matched by a null viewer.
    expect(canEditCard({ homeUserId: null, awayUserId: null, isManager: false, viewerUserId: null, locked: false })).toBe(false);
  });

  it("lets managers change any card, locked or not", () => {
    expect(canEditCard({ ...card, isManager: true, viewerUserId: "manager", locked: true })).toBe(true);
  });
});

describe("who can confirm a card", () => {
  const entered = {
    homeUserId: "home-player",
    awayUserId: "away-player",
    locked: false,
    status: "ENTERED" as const,
    enteredById: "home-player",
  };

  it("is the other player at the table", () => {
    expect(canConfirmCard({ ...entered, isManager: false, viewerUserId: "away-player" })).toBe(true);
  });

  it("is never the person who entered it", () => {
    expect(canConfirmCard({ ...entered, isManager: false, viewerUserId: "home-player" })).toBe(false);
  });

  it("is never someone from another table", () => {
    expect(canConfirmCard({ ...entered, isManager: false, viewerUserId: "someone-else" })).toBe(false);
  });

  it("can always be a manager, and only applies to cards waiting on confirmation", () => {
    expect(canConfirmCard({ ...entered, isManager: true, viewerUserId: "manager" })).toBe(true);
    expect(canConfirmCard({ ...entered, status: "CONFIRMED", isManager: true, viewerUserId: "manager" })).toBe(false);
    expect(canConfirmCard({ ...entered, status: "EMPTY", isManager: false, viewerUserId: "away-player" })).toBe(false);
  });

  it("stops once the match is locked, except for managers", () => {
    expect(canConfirmCard({ ...entered, locked: true, isManager: false, viewerUserId: "away-player" })).toBe(false);
  });
});

describe("statusAfterSave", () => {
  it("makes a manager's entry final and a player's wait for confirmation", () => {
    expect(statusAfterSave(true)).toBe("CONFIRMED");
    expect(statusAfterSave(false)).toBe("ENTERED");
  });
});

describe("formatCardScores", () => {
  it("shows both games, marking EROs, and a dash for games not entered", () => {
    expect(formatCardScores(gamesToScores(win("home", 4, true), win("away", 6)))).toBe("10*–4, 6–10");
    expect(
      formatCardScores({
        homeGame1: 0,
        awayGame1: 0,
        homeGame2: 0,
        awayGame2: 0,
        homeGame1Ero: false,
        awayGame1Ero: false,
        homeGame2Ero: false,
        awayGame2Ero: false,
      })
    ).toBe("—, —");
  });
});
