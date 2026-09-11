import { describe, it, expect } from "vitest";
import {
  createEditorToken,
  passcodeMatches,
  safeNextPath,
  SESSION_MAX_AGE_SECONDS,
  usablePasscode,
  verifyEditorToken,
} from "@/lib/editor-token";

/**
 * The editor passcode is the only thing between the public internet and the
 * league's real data, so the rules that decide "is this device allowed to
 * edit?" are pinned here.
 */

const PASSCODE = "eight-ball-corner-pocket";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 11);

describe("usablePasscode", () => {
  it("locks editing when no passcode is configured", () => {
    expect(usablePasscode(undefined)).toBeNull();
    expect(usablePasscode("")).toBeNull();
    expect(usablePasscode("   ")).toBeNull();
  });

  it("locks editing when the passcode is too short to be worth anything", () => {
    expect(usablePasscode("pool")).toBeNull();
    expect(usablePasscode("1234567")).toBeNull();
  });

  it("accepts a long enough passcode, ignoring stray surrounding spaces", () => {
    expect(usablePasscode("12345678")).toBe("12345678");
    expect(usablePasscode(`  ${PASSCODE}\n`)).toBe(PASSCODE);
  });
});

describe("passcodeMatches", () => {
  it("accepts the exact passcode", () => {
    expect(passcodeMatches(PASSCODE, PASSCODE)).toBe(true);
  });

  it("forgives spaces a phone keyboard adds around it", () => {
    expect(passcodeMatches(` ${PASSCODE} `, PASSCODE)).toBe(true);
  });

  it("rejects anything else, including near misses and blanks", () => {
    expect(passcodeMatches("eight-ball-corner-pocke", PASSCODE)).toBe(false);
    expect(passcodeMatches(`${PASSCODE}x`, PASSCODE)).toBe(false);
    expect(passcodeMatches(PASSCODE.toUpperCase(), PASSCODE)).toBe(false);
    expect(passcodeMatches("", PASSCODE)).toBe(false);
  });
});

describe("editor session tokens", () => {
  it("verifies a token signed with the current passcode", () => {
    const token = createEditorToken(PASSCODE, NOW);
    expect(verifyEditorToken(token, PASSCODE, NOW)).toBe(true);
    expect(verifyEditorToken(token, PASSCODE, NOW + 29 * DAY)).toBe(true);
  });

  it("signs every device out when the passcode is changed", () => {
    const token = createEditorToken(PASSCODE, NOW);
    expect(verifyEditorToken(token, "a-brand-new-passcode", NOW)).toBe(false);
  });

  it("locks out even previously signed-in devices if the passcode is removed", () => {
    const token = createEditorToken(PASSCODE, NOW);
    expect(verifyEditorToken(token, null, NOW)).toBe(false);
  });

  it("expires after 30 days, whatever the browser's cookie says", () => {
    const token = createEditorToken(PASSCODE, NOW);
    expect(verifyEditorToken(token, PASSCODE, NOW + SESSION_MAX_AGE_SECONDS * 1000)).toBe(true);
    expect(verifyEditorToken(token, PASSCODE, NOW + SESSION_MAX_AGE_SECONDS * 1000 + 1)).toBe(
      false
    );
  });

  it("rejects a token whose sign-in time was edited to extend it", () => {
    const [, sig] = createEditorToken(PASSCODE, NOW).split(".");
    const later = NOW + 25 * DAY;
    expect(verifyEditorToken(`${later}.${sig}`, PASSCODE, NOW + 35 * DAY)).toBe(false);
  });

  it("rejects a token dated in the future", () => {
    const token = createEditorToken(PASSCODE, NOW + DAY);
    expect(verifyEditorToken(token, PASSCODE, NOW)).toBe(false);
  });

  it("rejects a tampered or made-up signature", () => {
    const token = createEditorToken(PASSCODE, NOW);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyEditorToken(flipped, PASSCODE, NOW)).toBe(false);
    expect(verifyEditorToken(`${NOW}.not-a-real-signature`, PASSCODE, NOW)).toBe(false);
  });

  it("rejects garbage without throwing", () => {
    for (const junk of [undefined, "", ".", "abc", `${NOW}`, `${NOW}.`, `.sig`, "1.2.3", "-5.sig"]) {
      expect(verifyEditorToken(junk, PASSCODE, NOW)).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site, query string included", () => {
    expect(safeNextPath("/leagues/abc/matches/new")).toBe("/leagues/abc/matches/new");
    expect(safeNextPath("/login?next=%2F")).toBe("/login?next=%2F");
  });

  it("falls back to the home page for anything that isn't a path", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(["/leagues"])).toBe("/");
    expect(safeNextPath("leagues")).toBe("/");
  });

  it("refuses to send anyone to another website", () => {
    for (const offsite of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(offsite)).toBe("/");
    }
  });
});
