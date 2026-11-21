import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Exact-match public paths (no sub-routes).
const PUBLIC_EXACT_PATHS = ["/"];
// Public paths that also cover their own sub-routes.
const PUBLIC_PREFIX_PATHS = ["/login", "/forgot-password", "/book"];

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIX_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Cheap cookie-presence check only — redirects obviously-unauthenticated
 * requests before they render. The authoritative session/permission check
 * (DB lookup, expiry, role) happens in the (dashboard) layout via
 * `requireUser()` / `requirePermission()`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (isPublicPath(pathname)) {
    if (hasSessionCookie && pathname === "/login") {
      // The app found no session for this cookie: drop it and show the sign-in page.
      if (request.nextUrl.searchParams.get("session") === "expired") {
        const response = NextResponse.next();
        response.cookies.delete(SESSION_COOKIE_NAME);
        return response;
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)"],
};
