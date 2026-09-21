import { auth } from "@fine-leads/auth";
import { NextResponse } from "next/server";

const protectedApiPrefixes = [
  "/api/agents/",
  "/api/billing/",
  "/api/purchases/",
  "/api/user/",
  "/api/analytics/",
  "/api/lists/",
];

const protectedApiExact = [
  "/api/stripe/checkout",
  "/api/stripe/wallet-checkout",
  "/api/stripe/portal",
];

const adminApiPrefixes = ["/api/admin/"];

const publicAuthRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
];

function isProtectedApi(pathname: string): boolean {
  if (protectedApiExact.includes(pathname)) return true;
  return protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isAdminApi(pathname: string): boolean {
  return adminApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function getAuthRedirect(pathname: string, role?: string): string {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return "/admin";
  }
  return "/dashboard";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!req.auth) {
    if (pathname.startsWith("/dashboard")) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
    if (pathname.startsWith("/admin")) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
    if (isProtectedApi(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isAdminApi(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (req.auth) {
    const role = req.auth.user?.role;

    if (pathname.startsWith("/admin")) {
      if (role === "USER") {
        const dashboardUrl = new URL("/dashboard", req.url);
        return NextResponse.redirect(dashboardUrl);
      }
    }

    if (publicAuthRoutes.includes(pathname)) {
      const redirectUrl = new URL(getAuthRedirect(pathname, role), req.url);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAdminApi(pathname)) {
      if (role === "USER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/verify-email",
    "/api/agents/:path*",
    "/api/lists/:path*",
    "/api/billing/:path*",
    "/api/purchases/:path*",
    "/api/user/:path*",
    "/api/analytics/:path*",
    "/api/admin/:path*",
    "/api/stripe/checkout",
    "/api/stripe/wallet-checkout",
    "/api/stripe/portal",
  ],
};