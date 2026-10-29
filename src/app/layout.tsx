import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "RBSM Connect",
  description: "Matchmaking and meeting booking for India SME Forum Reverse Buyer-Seller Meets.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="bar">
          <div className="wrap">
            <Link href="/" className="brand">
              <i aria-hidden="true" />
              RBSM Connect <small>India SME Forum · International Trade Desk</small>
            </Link>
            <nav>
              <Link href="/">Events</Link>
              {user?.isAdmin && <Link href="/admin">Organiser</Link>}
              {user ? (
                <form action={signOut}>
                  <button type="submit" title={user.email}>Sign out</button>
                </form>
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer>
          <div className="wrap">India SME Forum · International Trade Desk · itd@indiasmeforum.org</div>
        </footer>
      </body>
    </html>
  );
}
