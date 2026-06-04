import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getActiveUser, logoutAction } from "@/app/actions/user";
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
  // Get currently logged in user
  const currentUser = await getActiveUser();

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

              {currentUser && (
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
                  {currentUser.role === "ADMIN" && (
                    <Link
                      href="/admin/users"
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        transition: "color var(--transition-fast)",
                      }}
                      className="nav-link"
                    >
                      Users
                    </Link>
                  )}
                </nav>
              )}
            </div>

            {currentUser && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                  Watching as: <strong style={{ color: "var(--text-primary)" }}>{currentUser.name} {currentUser.role === "ADMIN" ? "👑" : "🍿"}</strong>
                </span>
                <Link
                  href="/settings"
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    transition: "color var(--transition-fast)",
                  }}
                  className="nav-link"
                >
                  ⚙️ Settings
                </Link>
                <form action={logoutAction} style={{ display: "inline" }}>
                  <button 
                    type="submit" 
                    className="btn btn-secondary" 
                    style={{ 
                      padding: "6px 12px", 
                      fontSize: "0.85rem",
                      cursor: "pointer" 
                    }}
                  >
                    Log Out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
      </body>
    </html>
  );
}
