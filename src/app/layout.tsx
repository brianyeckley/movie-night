import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import UserSwitcher from "@/components/UserSwitcher";
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
  metadataBase: new URL("http://localhost:4000"),
  title: "🎬 Movie Night — Vote & Watch",
  description: "Host the ultimate movie night. Suggest titles, vote in real-time, browse the custom catalog, and play embedded trailers inside a beautiful glassmorphic dashboard!",
  openGraph: {
    title: "🎬 Movie Night — Vote & Watch",
    description: "Host the ultimate movie night. Suggest titles, vote in real-time, browse the custom catalog, and play embedded trailers inside a beautiful glassmorphic dashboard!",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Movie Night - Real-time Voting & Movie Tracker",
      },
    ],
    siteName: "Movie Night",
  },
  twitter: {
    card: "summary_large_image",
    title: "🎬 Movie Night — Vote & Watch",
    description: "Host the ultimate movie night. Suggest titles, vote in real-time, browse the custom catalog, and play embedded trailers inside a beautiful glassmorphic dashboard!",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch users from the database for simulated switching
  let users: any[] = [];
  try {
    users = await db.user.findMany({
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Failed to load users in layout:", error);
  }

  // Get current simulated user ID from cookies
  const cookieStore = await cookies();
  const activeUserId = cookieStore.get("movie_night_user")?.value || null;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--glass-border)",
            background: "rgba(8, 12, 20, 0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            position: "sticky",
            top: 0,
            zIndex: 100,
            padding: "16px 0",
          }}
        >
          <div
            className="container"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
              <Link href="/">
                <span
                  className="text-gradient"
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  🎬 Movie Night
                </span>
              </Link>
              <nav style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                <Link
                  href="/"
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    transition: "color var(--transition-fast)",
                  }}
                  className="nav-link"
                >
                  Dashboard
                </Link>
                <Link
                  href="/catalog"
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    transition: "color var(--transition-fast)",
                  }}
                  className="nav-link"
                >
                  Catalog
                </Link>
              </nav>
            </div>
            <UserSwitcher users={users} activeUserId={activeUserId} />
          </div>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
      </body>
    </html>
  );
}
