import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

// Routes accessible without authentication
const PUBLIC_ROUTES = ["/login", "/"];

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

  // Authenticated on login page → redirect to dashboard
  if (session?.user && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
