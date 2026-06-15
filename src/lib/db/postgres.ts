import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;
let migratePromise: Promise<void> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getPool(): Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL no configurado.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const client = getPool();
  const result = await client.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (LOWER(email));
  `);

  const countRow = await queryOne<{ count: string }>("SELECT COUNT(*)::text AS count FROM app_users");
  const count = Number(countRow?.count ?? 0);
  if (count === 0) {
    const adminEmail = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.AUTH_ADMIN_PASSWORD?.trim();
    const adminName = process.env.AUTH_ADMIN_NAME?.trim() || "Administrador";

    if (adminEmail && adminPassword) {
      const { hashPassword } = await import("@/lib/auth/password");
      const hash = await hashPassword(adminPassword);
      await query(
        `INSERT INTO app_users (email, name, password_hash, role, active)
         VALUES ($1, $2, $3, 'admin', true)
         ON CONFLICT (email) DO NOTHING`,
        [adminEmail, adminName, hash],
      );
      console.log("[DB] Usuario admin inicial creado:", adminEmail);
    } else {
      console.warn(
        "[DB] Sin usuarios. Define AUTH_ADMIN_EMAIL y AUTH_ADMIN_PASSWORD para crear el admin inicial.",
      );
    }
  }
}

export async function ensureDatabaseReady(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!migratePromise) {
    migratePromise = runMigrations().catch((err) => {
      migratePromise = null;
      throw err;
    });
  }
  await migratePromise;
}
