import { NextResponse } from "next/server";
import { generateRawApiKey, hashApiKey } from "@/lib/auth/api-key";
import { isAuthEnabled } from "@/lib/auth/config";
import { AuthError, requireAuth } from "@/lib/auth/guard";
import { query, queryOne } from "@/lib/db/postgres";

interface ApiKeyListRow {
  id: string;
  label: string;
  key_prefix: string;
  active: boolean;
  created_at: Date;
  last_used_at: Date | null;
}

function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Error de autenticación";
  return NextResponse.json({ error: message }, { status: 500 });
}

// ── GET: listar keys del admin autenticado (sin key_hash) ──
export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth disabled" }, { status: 503 });
  }

  try {
    const user = await requireAuth("admin");
    const rows = await query<ApiKeyListRow>(
      `SELECT id, label, key_prefix, active, created_at, last_used_at
       FROM api_keys WHERE created_by = $1 ORDER BY created_at DESC`,
      [user.id],
    );
    return NextResponse.json({ keys: rows });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// ── POST: generar nueva key (raw solo una vez) ───────────
export async function POST(req: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth disabled" }, { status: 503 });
  }

  try {
    const user = await requireAuth("admin");
    const body = await req.json().catch(() => ({}));
    const label = String(body.label ?? "Hermes Bot").trim() || "Hermes Bot";

    const { rawKey, prefix } = generateRawApiKey();
    const keyHash = hashApiKey(rawKey);

    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO api_keys (label, key_hash, key_prefix, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [label, keyHash, prefix, user.id],
    );

    return NextResponse.json(
      { id: inserted?.id, key: rawKey, label, prefix },
      { status: 201 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

// ── DELETE: revocar key por id (solo el creador) ──────────
export async function DELETE(req: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth disabled" }, { status: 503 });
  }

  try {
    const user = await requireAuth("admin");
    const body = await req.json().catch(() => ({}));
    const keyId = String(body.id ?? "").trim();
    if (!keyId) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }

    const row = await queryOne<{ id: string }>(
      `UPDATE api_keys SET active = false
       WHERE id = $1 AND created_by = $2 AND active = true
       RETURNING id`,
      [keyId, user.id],
    );

    if (!row) {
      return NextResponse.json({ error: "API key no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ revoked: true, id: row.id });
  } catch (error) {
    return authErrorResponse(error);
  }
}
