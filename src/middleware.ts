import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import {
  canAccessSettings,
  isViewerBlockedApi,
  isViewerBlockedPath,
} from "@/lib/auth/permissions";
import { getSessionFromRequest } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/login")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico" || pathname.startsWith("/logo")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();

  const session = await getSessionFromRequest(req);
  if (!session) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { pathname } = req.nextUrl;

  if (session.role === "viewer") {
    if (isViewerBlockedPath(pathname)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (isViewerBlockedApi(pathname, req.method)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/users") && session.role !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (pathname.startsWith("/settings") && !canAccessSettings(session.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};
