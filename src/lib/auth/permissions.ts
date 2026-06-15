import type { UserRole } from "./types";

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 1,
  analyst: 2,
  admin: 3,
};

export function hasMinRole(userRole: UserRole, required: UserRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

export function canAccessSettings(role: UserRole): boolean {
  return hasMinRole(role, "analyst");
}

export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}

/** Rutas de página bloqueadas para viewer */
export function isViewerBlockedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/settings") ||
    pathname.startsWith("/reports")
  );
}

/** APIs de escritura/config bloqueadas para viewer */
export function isViewerBlockedApi(pathname: string, method: string): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  return (
    pathname.startsWith("/api/settings") ||
    pathname.startsWith("/api/scheduler") ||
    pathname.startsWith("/api/users")
  );
}
