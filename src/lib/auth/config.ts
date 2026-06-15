export const SESSION_COOKIE = "cr2_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 días

export function isAuthEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET no configurado (requerido cuando DATABASE_URL está definido).");
  }
  return secret;
}
