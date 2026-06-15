import { NextResponse } from "next/server";
import { isAuthEnabled } from "./config";
import { canManageUsers, hasMinRole } from "./permissions";
import { getSessionFromCookies } from "./session";
import type { SessionUser, UserRole } from "./types";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireAuth(minRole: UserRole = "viewer"): Promise<SessionUser> {
  if (!isAuthEnabled()) {
    return {
      id: "dev",
      email: "dev@local",
      name: "Desarrollo",
      role: "admin",
    };
  }

  const session = await getSessionFromCookies();
  if (!session) throw new AuthError("No autenticado", 401);
  if (!hasMinRole(session.role, minRole)) {
    throw new AuthError("Sin permisos", 403);
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth("admin");
  if (!canManageUsers(session.role)) throw new AuthError("Sin permisos", 403);
  return session;
}

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Error de autenticación";
  return NextResponse.json({ error: message }, { status: 500 });
}
