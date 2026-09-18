import { describe, it, expect } from "vitest";
import { isAdminEmail, parseAdminEmails } from "@/lib/admins";

/**
 * Admins can change anything in any league, so the rule for who counts as
 * one is pinned here. (Example addresses only: the real list lives in the
 * ADMIN_EMAILS environment variable, never in the repo.)
 */

const LIST = "owner@example.com, Co-Owner@Example.com ,";

describe("parseAdminEmails", () => {
  it("reads a comma-separated list, ignoring case, spaces, and blanks", () => {
    expect([...parseAdminEmails(LIST)]).toEqual(["owner@example.com", "co-owner@example.com"]);
  });

  it("is empty when the setting is missing or blank", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails("").size).toBe(0);
    expect(parseAdminEmails(" , ").size).toBe(0);
  });
});

describe("isAdminEmail", () => {
  it("makes nobody an admin when the list is missing or empty", () => {
    expect(isAdminEmail("owner@example.com", true, undefined)).toBe(false);
    expect(isAdminEmail("owner@example.com", true, "")).toBe(false);
  });

  it("matches a listed email regardless of case", () => {
    expect(isAdminEmail("owner@example.com", true, LIST)).toBe(true);
    expect(isAdminEmail("OWNER@EXAMPLE.COM", true, LIST)).toBe(true);
    expect(isAdminEmail("co-owner@example.com", true, LIST)).toBe(true);
  });

  it("rejects unlisted emails, including look-alikes", () => {
    expect(isAdminEmail("someone@example.com", true, LIST)).toBe(false);
    expect(isAdminEmail("owner@example.com.evil.test", true, LIST)).toBe(false);
    expect(isAdminEmail("xowner@example.com", true, LIST)).toBe(false);
  });

  it("requires the email to be verified by the sign-in provider", () => {
    expect(isAdminEmail("owner@example.com", false, LIST)).toBe(false);
  });

  it("handles a missing email", () => {
    expect(isAdminEmail(null, true, LIST)).toBe(false);
    expect(isAdminEmail(undefined, true, LIST)).toBe(false);
  });
});
