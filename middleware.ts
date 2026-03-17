import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const jwtToken = request.cookies.get("ai_tutor_jwt")?.value;

  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");

  if (isAuthPage && jwtToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/:path*"],
};
