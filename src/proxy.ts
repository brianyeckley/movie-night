import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

/**
 * Signed-in checks only.
 *
 * This runs on the edge runtime and cannot reach the database, so it can only
 * inspect the session cookie. Roles are deliberately not in that cookie - a
 * "remember me" token lasts ten years, and a role read from it would go stale
 * the moment an account was demoted.
 *
 * Admin pages therefore enforce their own access from the database (see
 * `requireAdmin()` for actions and the guard in /admin/users), which is both
 * the authoritative check and always current. This layer just keeps signed-out
 * visitors off the app.
 */
export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const requiresSignIn =
    path === "/" ||
    path.startsWith("/catalog") ||
    path.startsWith("/settings") ||
    path.startsWith("/admin");
  const isPublicRoute = path === "/login" || path === "/signup";

  const cookie = req.cookies.get("movie_night_session")?.value;
  const session = await decrypt(cookie);

  // 1. Send signed-out visitors to the login page
  if (requiresSignIn && !session?.userId) {
    const loginUrl = new URL("/login", req.nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Send signed-in users away from the auth pages
  if (isPublicRoute && session?.userId) {
    const dashboardUrl = new URL("/", req.nextUrl);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

// Apply middleware to all application routes, ignoring static assets and API routes
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
