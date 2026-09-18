// Who counts as an admin: anyone whose verified sign-in email is listed in the
// ADMIN_EMAILS environment variable (comma-separated). Granted only through
// that setting, never through the app, so nobody can make themselves an
// admin. Kept free of Next.js imports so it can be unit-tested directly.

export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.includes("@"))
  );
}

export function isAdminEmail(
  email: string | null | undefined,
  emailVerified: boolean,
  adminEmails: string | undefined
): boolean {
  // Only trust an email the sign-in provider (Google) has verified.
  if (!email || !emailVerified) return false;
  return parseAdminEmails(adminEmails).has(email.trim().toLowerCase());
}
