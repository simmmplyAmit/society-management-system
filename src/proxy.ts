import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { PUBLIC_PAGES } from "@/lib/site";

// Routes accessible without authentication (the website pages come from PUBLIC_PAGES)
const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", ...PUBLIC_PAGES.map((p) => p.href)];

// Role → allowed route prefixes
const ROLE_ROUTES: Record<Role, string[]> = {
  SUPER_ADMIN: ["/super-admin", "/dashboard"],
  ADMIN: ["/dashboard/admin", "/dashboard"],
  SECRETARY: ["/dashboard/secretary", "/dashboard"],
  TREASURER: ["/dashboard/treasurer", "/dashboard"],
  OWNER: ["/dashboard/resident", "/dashboard"],
  TENANT: ["/dashboard/resident", "/dashboard"],
};

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => nextUrl.pathname === route || nextUrl.pathname.startsWith(route + "/")
  );

  // Unauthenticated → redirect to login
  if (!session?.user && !isPublic) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated on the login page or the website's home page → redirect to dashboard
  if (session?.user && (nextUrl.pathname === "/login" || nextUrl.pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Skip API routes, Next internals and any file in /public (anything with an extension)
  matcher: ["/((?!api|_next/static|_next/image|icons|.*\\..*).*)"],
};
