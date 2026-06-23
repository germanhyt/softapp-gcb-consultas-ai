import { timingSafeEqual } from "crypto";
import {
  getToteatWebhookEffectiveSecret,
  isToteatWebhookEnabled,
} from "@/lib/config/toteat-webhook-config";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function extractWebhookSecret(req: Request, url: URL): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  const headerSecret = req.headers.get("x-webhook-secret")?.trim();
  if (headerSecret) return headerSecret;

  const querySecret = url.searchParams.get("secret")?.trim();
  if (querySecret) return querySecret;

  return null;
}

export type WebhookAuthResult =
  | { ok: true }
  | { ok: false; status: 403 | 401 | 503; error: string };

export function validateToteatWebhookRequest(req: Request, url: URL): WebhookAuthResult {
  if (!isToteatWebhookEnabled()) {
    return { ok: false, status: 503, error: "Webhook Toteat desactivado" };
  }

  const expected = getToteatWebhookEffectiveSecret();
  if (!expected) {
    return { ok: false, status: 503, error: "Webhook Toteat sin secret configurado" };
  }

  const provided = extractWebhookSecret(req, url);
  if (!provided) {
    return {
      ok: false,
      status: 401,
      error: "Falta autenticación (Authorization: Bearer, X-Webhook-Secret o ?secret=)",
    };
  }

  if (!safeEqual(provided, expected)) {
    return { ok: false, status: 403, error: "Secret inválido" };
  }

  return { ok: true };
}
