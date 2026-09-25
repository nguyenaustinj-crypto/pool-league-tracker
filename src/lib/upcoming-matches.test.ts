import { describe, it, expect } from "vitest";
import {
  homePageCutoff,
  matchAhead,
  startOfUtcDay,
  STALE_AFTER_DAYS,
  type UpcomingMatch,
  type UpcomingPairing,
} from "@/lib/upcoming-matches";

/**
 * What "Coming up" on the home page is allowed to show. The rules that
 * matter: a locked match is done, a future match always shows, and a past
 * match only stays while its scores are missing or a card is waiting on you
 * -- otherwise the list would fill with matches everyone has finished.
 */

const NOW = new Date("2026-09-25T19:00:00Z");
const day = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

function card(overrides: Partial<UpcomingPairing> = {}): UpcomingPairing {
  return {
    tableNumber: 1,
    homePlayerId: "me",
    awayPlayerId: "them",
    homeUserId: "my-account",
    awayUserId: "their-account",
    status: "EMPTY",
    enteredById: null,
    homeGame1: 0,
    homeGame2: 0,
    awayGame1: 0,
    awayGame2: 0,
    ...overrides,
  };
}

function match(date: Date, rounds: UpcomingPairing[][], lockedAt: Date | null = null): UpcomingMatch {
  return {
    date,
    lockedAt,
    rounds: rounds.map((pairings, i) => ({ roundNumber: i + 1, pairings })),
  };
}

const AS_ME = { playerId: "me", userId: "my-account", isManager: false, now: NOW };

describe("matchAhead", () => {
  it("shows a match scheduled for a later day", () => {
    const ahead = matchAhead(match(day("2026-10-02"), [[card()]]), AS_ME);
    expect(ahead).not.toBeNull();
    expect(ahead?.playing).toBe(true);
    expect(ahead?.tableNumber).toBe(1);
    expect(ahead?.roundsToPlay).toBe(1);
    expect(ahead?.started).toBe(false);
    expect(ahead?.scheduledAhead).toBe(true);
  });

  it("still shows a match dated today, part-way through the evening", () => {
    // Today's date is stored as midnight, which is already behind us.
    expect(matchAhead(match(day("2026-09-25"), [[card()]]), AS_ME)).not.toBeNull();
  });

  it("never shows a locked match, however recent", () => {
    const locked = match(day("2026-09-25"), [[card()]], new Date("2026-09-25T18:00:00Z"));
    expect(matchAhead(locked, AS_ME)).toBeNull();
  });

  it("keeps a past match while a round still has no scores", () => {
    const played = card({ homeGame1: 10, homeGame2: 10, awayGame1: 2, awayGame2: 3 });
    const ahead = matchAhead(match(day("2026-09-20"), [[played], [card()]]), AS_ME);
    expect(ahead?.roundsToPlay).toBe(1);
    expect(ahead?.started).toBe(true);
    expect(ahead?.scheduledAhead).toBe(false);
  });

  it("drops a past match once every round is scored and nothing needs confirming", () => {
    const played = card({
      homeGame1: 10,
      homeGame2: 10,
      awayGame1: 2,
      awayGame2: 3,
      status: "CONFIRMED",
    });
    expect(matchAhead(match(day("2026-09-20"), [[played]]), AS_ME)).toBeNull();
  });

  it("keeps a past match that's waiting on this player to confirm a card", () => {
    const entered = card({
      homeGame1: 10,
      homeGame2: 4,
      awayGame1: 3,
      awayGame2: 10,
      status: "ENTERED",
      // The other player entered it, so confirming is this player's to do.
      enteredById: "their-account",
    });
    const ahead = matchAhead(match(day("2026-09-20"), [[entered]]), AS_ME);
    expect(ahead?.cardsToConfirm).toBe(1);
  });

  it("doesn't ask the person who entered a card to confirm their own", () => {
    const mine = card({
      homeGame1: 10,
      homeGame2: 4,
      awayGame1: 3,
      awayGame2: 10,
      status: "ENTERED",
      enteredById: "my-account",
    });
    expect(matchAhead(match(day("2026-09-20"), [[mine]]), AS_ME)).toBeNull();
  });

  it("does ask a manager to confirm any entered card, including one at another table", () => {
    const someoneElses = card({
      homePlayerId: "a",
      awayPlayerId: "b",
      homeUserId: "a-account",
      awayUserId: "b-account",
      homeGame1: 10,
      homeGame2: 4,
      awayGame1: 3,
      awayGame2: 10,
      status: "ENTERED",
      enteredById: "a-account",
    });
    const ahead = matchAhead(match(day("2026-09-20"), [[someoneElses]]), {
      ...AS_ME,
      playerId: null,
      isManager: true,
    });
    expect(ahead?.cardsToConfirm).toBe(1);
    expect(ahead?.playing).toBe(false);
    expect(ahead?.tableNumber).toBeNull();
  });

  it("lets go of an unfinished match once it's long past", () => {
    const old = match(day("2026-08-01"), [[card()]]);
    expect(matchAhead(old, AS_ME)).toBeNull();
    // ...but not one that's only just over the line of being recent.
    const recent = match(day("2026-09-13"), [[card()]]);
    expect(matchAhead(recent, AS_ME)).not.toBeNull();
  });

  it("reports the viewer's own table from the lineup, not the first table", () => {
    const round1 = [
      card({ homePlayerId: "someone", awayPlayerId: "else", tableNumber: 1 }),
      card({ tableNumber: 2 }),
    ];
    expect(matchAhead(match(day("2026-10-02"), [round1]), AS_ME)?.tableNumber).toBe(2);
  });

  it("marks a member who isn't in the lineup as not playing", () => {
    const others = [card({ homePlayerId: "a", awayPlayerId: "b" })];
    const ahead = matchAhead(match(day("2026-10-02"), [others]), AS_ME);
    expect(ahead?.playing).toBe(false);
    expect(ahead?.tableNumber).toBeNull();
  });
});

describe("day boundaries", () => {
  it("treats a match date as its whole UTC day", () => {
    expect(startOfUtcDay(NOW).toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });

  it("cuts off the database query at the same point the list does", () => {
    const cutoff = homePageCutoff(NOW);
    expect(cutoff.toISOString()).toBe("2026-09-11T00:00:00.000Z");
    expect(STALE_AFTER_DAYS).toBe(14);
  });
});
