import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { isSiteAdmin } from "@/lib/editor";
import { signOut } from "@/lib/editor-actions";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pool League Tracker",
  description: "Track pool league matches, players, and scores.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The header only shows who's signed in. Access checks happen in each page
  // and action (src/lib/access.ts), never here: layouts don't re-run on
  // every navigation.
  const [user, siteAdmin] = await Promise.all([getCurrentUser(), isSiteAdmin()]);
  const signedIn = Boolean(user) || siteAdmin;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b bg-neutral-900 text-white">
          <nav className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3 text-sm font-medium">
            <Link href="/" className="text-base font-bold">
              🎱 Pool League
            </Link>
            <div className="ml-auto flex items-center gap-4">
              {signedIn && (
                <Link href="/" className="hover:underline">
                  My leagues
                </Link>
              )}
              {user && (
                <span className="hidden max-w-32 truncate text-neutral-300 sm:inline">
                  {user.name.split(" ")[0]}
                </span>
              )}
              {signedIn ? (
                <form action={signOut}>
                  <button type="submit" className="hover:underline">
                    Sign out
                  </button>
                </form>
              ) : (
                <Link href="/login" className="hover:underline">
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
