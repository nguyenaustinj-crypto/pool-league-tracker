import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { isEditor } from "@/lib/editor";
import { signOut } from "@/lib/editor-actions";
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
  const canEdit = await isEditor();

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
            <Link href="/" className="ml-auto hover:underline">
              Leagues
            </Link>
            {canEdit ? (
              <form action={signOut}>
                <button type="submit" className="hover:underline">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className="hover:underline">
                Editor sign in
              </Link>
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
