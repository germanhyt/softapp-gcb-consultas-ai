import { ensureDatabaseReady, query, queryOne } from "@/lib/db/postgres";
import { hashPassword } from "@/lib/auth/password";
import type { AppUser, SessionUser, UserRole } from "@/lib/auth/types";
import { USER_ROLES } from "@/lib/auth/types";

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: UserRole;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  };
}

export async function listUsers(): Promise<AppUser[]> {
  await ensureDatabaseReady();
  const rows = await query<UserRow>(
    `SELECT id, email, name, password_hash, role, active, created_at, updated_at, last_login_at
     FROM app_users
     ORDER BY created_at ASC`,
  );
  return rows.map(mapUser);
}

export async function findUserByEmail(email: string): Promise<(AppUser & { passwordHash: string }) | null> {
  await ensureDatabaseReady();
  const row = await queryOne<UserRow>(
    `SELECT id, email, name, password_hash, role, active, created_at, updated_at, last_login_at
     FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email.trim()],
  );
  if (!row) return null;
  return { ...mapUser(row), passwordHash: row.password_hash };
}

export async function findUserById(id: string): Promise<AppUser | null> {
  await ensureDatabaseReady();
  const row = await queryOne<UserRow>(
    `SELECT id, email, name, password_hash, role, active, created_at, updated_at, last_login_at
     FROM app_users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return row ? mapUser(row) : null;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.active) return null;

  const { verifyPassword } = await import("@/lib/auth/password");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  await query(`UPDATE app_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [
    user.id,
  ]);

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  active?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<AppUser> {
  await ensureDatabaseReady();
  if (!USER_ROLES.includes(input.role)) {
    throw new Error("Rol inválido.");
  }
  const hash = await hashPassword(input.password);
  const row = await queryOne<UserRow>(
    `INSERT INTO app_users (email, name, password_hash, role, active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, password_hash, role, active, created_at, updated_at, last_login_at`,
    [
      input.email.trim().toLowerCase(),
      input.name.trim(),
      hash,
      input.role,
      input.active ?? true,
    ],
  );
  if (!row) throw new Error("No se pudo crear el usuario.");
  return mapUser(row);
}

export interface UpdateUserInput {
  id: string;
  email?: string;
  name?: string;
  password?: string;
  role?: UserRole;
  active?: boolean;
}

export async function updateUser(input: UpdateUserInput): Promise<AppUser | null> {
  await ensureDatabaseReady();
  const current = await findUserById(input.id);
  if (!current) return null;

  const email = input.email?.trim().toLowerCase() ?? current.email;
  const name = input.name?.trim() ?? current.name;
  const role = input.role ?? current.role;
  const active = input.active ?? current.active;

  if (!USER_ROLES.includes(role)) throw new Error("Rol inválido.");

  let passwordHash: string | undefined;
  if (input.password && input.password.trim()) {
    passwordHash = await hashPassword(input.password.trim());
  }

  const row = await queryOne<UserRow>(
    `UPDATE app_users
     SET email = $2, name = $3, role = $4, active = $5,
         password_hash = COALESCE($6, password_hash),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, password_hash, role, active, created_at, updated_at, last_login_at`,
    [input.id, email, name, role, active, passwordHash ?? null],
  );
  return row ? mapUser(row) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  await ensureDatabaseReady();
  const rows = await query(`DELETE FROM app_users WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}

export async function countActiveAdmins(excludeId?: string): Promise<number> {
  await ensureDatabaseReady();
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM app_users
     WHERE role = 'admin' AND active = true ${excludeId ? "AND id <> $1" : ""}`,
    excludeId ? [excludeId] : [],
  );
  return Number(row?.count ?? 0);
}
