import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/dashboard",
  "/courses",
  "/materials",
  "/notes",
  "/favorites",
  "/profile",
  "/admin"
];

export function middleware(request: NextRequest) {
  const hasSession = Boolean(
    request.cookies.get(process.env.SESSION_COOKIE_NAME ?? "studyhub_session")
  );
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/courses/:path*",
    "/materials/:path*",
    "/notes/:path*",
    "/favorites/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/login",
    "/register"
  ]
};
