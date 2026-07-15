import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { queryOne } from "@/lib/db/postgres";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function generateRawApiKey(): { rawKey: string; prefix: string } {
  const rawKey = `hrms_${randomUUID().replace(/-/g, "")}`;
  const prefix = `${rawKey.slice(0, 12)}...`;
  return { rawKey, prefix };
}

/** Valida una API key, actualiza last_used_at y devuelve created_by si es válida. */
export async function validateApiKey(rawKey: string): Promise<string | null> {
  const candidate = rawKey.trim();
  if (!candidate.startsWith("hrms_") || candidate.length < 20) {
    return null;
  }

  const hash = hashApiKey(candidate);
  const row = await queryOne<{ created_by: string; key_hash: string }>(
    `UPDATE api_keys SET last_used_at = NOW()
     WHERE key_hash = $1 AND active = true
     RETURNING created_by, key_hash`,
    [hash],
  );

  if (!row || !safeEqualHex(hash, row.key_hash)) {
    return null;
  }

  return row.created_by;
}
