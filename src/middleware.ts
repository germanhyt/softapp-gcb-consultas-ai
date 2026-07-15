import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import {
  canAccessSettings,
  isViewerBlockedApi,
  isViewerBlockedPath,
} from "@/lib/auth/permissions";
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/auth/rate-limit";
import { getSessionFromRequest } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];

/** Fail-fast en edge/middleware antes de llegar al route (misma ventana que el chat). */
const BEARER_CHAT_LIMIT = 60;
const BEARER_CHAT_WINDOW_MS = 60_000;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/login")) return true;
  if (pathname.startsWith("/api/webhooks/toteat")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico" || pathname.startsWith("/logo")) return true;
  return false;
}

function hasBearerApiKey(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return Boolean(auth?.startsWith("Bearer ") && auth.slice("Bearer ".length).trim());
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function middleware(req: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();

  // Hermes / agentes externos: dejar pasar Bearer a /api/ai/chat
  // (la validación de la API key la hace el route handler).
  if (req.nextUrl.pathname.startsWith("/api/ai/chat") && hasBearerApiKey(req)) {
    pruneRateLimitBuckets();
    const rl = checkRateLimit(`mw:ai-chat:apikey:${clientIp(req)}`, {
      limit: BEARER_CHAT_LIMIT,
      windowMs: BEARER_CHAT_WINDOW_MS,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        },
      );
    }
    return NextResponse.next();
  }

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
