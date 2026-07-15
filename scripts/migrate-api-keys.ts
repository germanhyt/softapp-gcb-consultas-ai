/**
 * Ejecuta la migración de la tabla api_keys.
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/migrate-api-keys.ts
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnvFile(join(process.cwd(), ".env.local"));
  loadEnvFile(join(process.cwd(), ".env"));

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no configurado.");
  }

  const sqlPath = join(process.cwd(), "scripts", "migrations", "002_create_api_keys.sql");
  if (!existsSync(sqlPath)) {
    throw new Error(`No se encontró el SQL de migración: ${sqlPath}`);
  }

  const sql = readFileSync(sqlPath, "utf8");
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(sql);
    console.log("[migrate-api-keys] Tabla api_keys creada/verificada correctamente.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate-api-keys] Error:", err);
  process.exit(1);
});
