import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Define route classification
  const isProtectedRoute = path === "/" || path.startsWith("/catalog");
  const isAdminRoute = path.startsWith("/admin");
  const isPublicRoute = path === "/login" || path === "/signup";

  // Retrieve the session cookie
  const cookie = req.cookies.get("movie_night_session")?.value;
  const session = await decrypt(cookie);

  // 1. Redirect unauthenticated users to login page
  if ((isProtectedRoute || isAdminRoute) && !session?.userId) {
    const loginUrl = new URL("/login", req.nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Redirect authenticated users away from public auth pages to dashboard
  if (isPublicRoute && session?.userId) {
    const dashboardUrl = new URL("/", req.nextUrl);
    return NextResponse.redirect(dashboardUrl);
  }

  // 3. Prevent standard users from accessing admin routes
  if (isAdminRoute && session?.role !== "ADMIN") {
    const dashboardUrl = new URL("/", req.nextUrl);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

// Apply middleware to all application routes, ignoring static assets and API routes
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
