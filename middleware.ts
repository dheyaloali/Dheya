import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
  // Log all cookies
  const allCookies = request.cookies.getAll();
  console.log("ALL COOKIES:", allCookies);

  // Try to get the session token (handle chunked cookies)
  let tokenString = request.cookies.get("next-auth.session-token")?.value;

  // Reassemble chunked cookies if present
  if (!tokenString) {
    let i = 0, chunk: string | undefined = "";
    while ((chunk = request.cookies.get(`next-auth.session-token.${i}`)?.value) !== undefined) {
      tokenString = (tokenString || "") + chunk;
      i++;
    }
  }

  let token: any = null;
  if (tokenString) {
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
      const { payload } = await jwtVerify(tokenString, secret);
      token = payload;
    } catch (e) {
      console.log("JOSE JWT VERIFY ERROR:", e);
      token = null;
    }
  }
  console.log("MIDDLEWARE USER:", token);

  const { pathname } = request.nextUrl;

  // Protect /admin routes
  if (pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!token.isAdmin) {
      return NextResponse.redirect(new URL("/employee/dashboard", request.url));
    }
  }

  // Protect /employee routes
  if (pathname.startsWith("/employee")) {
    if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
    if (token.isAdmin) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    if (!token.isApproved) {
      return NextResponse.redirect(new URL("/waiting-approval", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/employee/:path*"],
}; 