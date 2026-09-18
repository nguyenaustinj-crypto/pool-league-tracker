import { describe, it, expect } from "vitest";
import {
  hashInviteToken,
  isWellFormedInviteToken,
  MANAGER_INVITE_DAYS,
  managerInviteExpiry,
  newInviteToken,
} from "@/lib/invite-token";

describe("invite tokens", () => {
  it("are 32 URL-safe characters, and different every time", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newInviteToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(isWellFormedInviteToken(token)).toBe(true);
    }
  });

  it("hash the same way every time, and differently for different tokens", () => {
    const token = newInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toBe(hashInviteToken(newInviteToken()));
    // The stored hash doesn't contain the token itself.
    expect(hashInviteToken(token)).not.toContain(token);
  });

  it("rejects anything that can't be a token", () => {
    for (const junk of [undefined, null, 42, "", "short", "x".repeat(33), "has spaces in it....................", "../../../etc/passwd.............."]) {
      expect(isWellFormedInviteToken(junk)).toBe(false);
    }
  });

  it("expire manager invites after 14 days", () => {
    const now = Date.UTC(2026, 8, 18);
    expect(MANAGER_INVITE_DAYS).toBe(14);
    expect(managerInviteExpiry(now).getTime() - now).toBe(14 * 24 * 60 * 60 * 1000);
  });
});
