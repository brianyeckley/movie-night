import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getActiveUser } from "@/app/actions/user";
import Header from "@/components/Header";
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
        <Header currentUser={currentUser} />
        <div className="flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
