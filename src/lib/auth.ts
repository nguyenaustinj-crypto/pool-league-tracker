import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

// Sign-in: "Sign in with Google" via Better Auth, with accounts stored in our
// own database. No passwords anywhere. See docs/spec-accounts.md.

/**
 * Whether every setting sign-in needs is present. If any is missing, sign-in
 * is switched off and the rest of the site keeps working, instead of every
 * page failing.
 */
export function signInConfigured(): boolean {
  return Boolean(
    process.env.BETTER_AUTH_SECRET &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
  );
}

function createAuth() {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        // Always ask which Google account, since family members may share a
        // phone or laptop.
        prompt: "select_account",
      },
    },
    session: {
      // League night is weekly, so a short session would sign out anyone who
      // skips a week. Sessions last 60 days and are extended (at most once a
      // day) whenever the app is used, so regular players stay signed in.
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
    },
    // Lets server actions set and clear the sign-in cookie. Must stay last.
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** The Better Auth instance, or null if sign-in isn't configured. */
export function getAuth() {
  if (!signInConfigured()) return null;
  instance ??= createAuth();
  return instance;
}
