import { describe, it, expect } from "vitest";
import { leaguePermissions, leavesNoManager, normalizeLeagueSearch } from "@/lib/permissions";

/**
 * Leagues are members-only, and only managers can change them. These rules
 * decide who can see and edit real league data, so they're pinned here.
 */

describe("leaguePermissions", () => {
  it("lets site admins see, manage, and delete any league, member or not", () => {
    expect(leaguePermissions({ isSiteAdmin: true, role: null })).toEqual({
      canView: true,
      canInvitePlayers: true,
      canManage: true,
      canDelete: true,
      canRequestManager: false,
    });
  });

  it("lets a league's managers see, manage, and invite, but not delete it", () => {
    expect(leaguePermissions({ isSiteAdmin: false, role: "MANAGER" })).toEqual({
      canView: true,
      canInvitePlayers: true,
      canManage: true,
      canDelete: false,
      canRequestManager: false,
    });
  });

  it("lets players see their league, share its player invite, and ask to be a manager", () => {
    expect(leaguePermissions({ isSiteAdmin: false, role: "PLAYER" })).toEqual({
      canView: true,
      canInvitePlayers: true,
      canManage: false,
      canDelete: false,
      canRequestManager: true,
    });
  });

  it("gives someone outside the league nothing at all", () => {
    expect(leaguePermissions({ isSiteAdmin: false, role: null })).toEqual({
      canView: false,
      canInvitePlayers: false,
      canManage: false,
      canDelete: false,
      canRequestManager: false,
    });
  });
});

describe("leavesNoManager", () => {
  const members = [
    { userId: "manager", role: "MANAGER" as const },
    { userId: "player", role: "PLAYER" as const },
  ];

  it("blocks demoting or removing the only manager", () => {
    expect(leavesNoManager(members, "manager", "PLAYER")).toBe(true);
    expect(leavesNoManager(members, "manager", null)).toBe(true);
  });

  it("allows it once there's another manager", () => {
    const twoManagers = [...members, { userId: "co-manager", role: "MANAGER" as const }];
    expect(leavesNoManager(twoManagers, "manager", "PLAYER")).toBe(false);
    expect(leavesNoManager(twoManagers, "manager", null)).toBe(false);
  });

  it("never blocks changes to players, or promotions", () => {
    expect(leavesNoManager(members, "player", null)).toBe(false);
    expect(leavesNoManager(members, "player", "MANAGER")).toBe(false);
    expect(leavesNoManager(members, "manager", "MANAGER")).toBe(false);
  });

  it("doesn't block anything in a league that already has no managers", () => {
    const noManagers = [{ userId: "player", role: "PLAYER" as const }];
    expect(leavesNoManager(noManagers, "player", null)).toBe(false);
  });
});

describe("normalizeLeagueSearch", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeLeagueSearch("  Island   billiards ")).toBe("Island billiards");
  });

  it("ignores searches too short or missing", () => {
    expect(normalizeLeagueSearch(undefined)).toBeNull();
    expect(normalizeLeagueSearch(["island"])).toBeNull();
    expect(normalizeLeagueSearch("")).toBeNull();
    expect(normalizeLeagueSearch(" a ")).toBeNull();
  });

  it("caps very long searches", () => {
    expect(normalizeLeagueSearch("x".repeat(500))).toHaveLength(60);
  });
});
