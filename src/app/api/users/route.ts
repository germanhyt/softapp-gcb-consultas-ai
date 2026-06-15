import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth/guard";
import {
  countActiveAdmins,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "@/lib/users/repository";
import { USER_ROLES, type UserRole } from "@/lib/auth/types";

function sanitizeUser(user: Awaited<ReturnType<typeof listUsers>>[number]) {
  const { ...safe } = user;
  return safe;
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await listUsers();
    return NextResponse.json(users.map(sanitizeUser));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "viewer") as UserRole;
    const active = body.active !== false;

    if (!email || !name || !password) {
      return NextResponse.json({ error: "Email, nombre y contraseña requeridos" }, { status: 400 });
    }
    if (!USER_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const user = await createUser({ email, name, password, role, active });
    return NextResponse.json(sanitizeUser(user), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear usuario";
    const status = message.includes("duplicate") || message.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const role = body.role !== undefined ? (String(body.role) as UserRole) : undefined;
    if (role && !USER_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const password = body.password !== undefined ? String(body.password) : undefined;
    if (password && password.length > 0 && password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const { findUserById } = await import("@/lib/users/repository");
    const existing = await findUserById(id);
    if (!existing) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (id === session.id && body.active === false) {
      return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
    }

    const nextRole = role ?? existing.role;
    const nextActive = body.active !== undefined ? Boolean(body.active) : existing.active;
    if (
      existing.role === "admin" &&
      existing.active &&
      (nextRole !== "admin" || !nextActive)
    ) {
      const admins = await countActiveAdmins(id);
      if (admins === 0) {
        return NextResponse.json(
          { error: "Debe existir al menos un administrador activo" },
          { status: 400 },
        );
      }
    }

    const current = await updateUser({
      id,
      email: body.email !== undefined ? String(body.email) : undefined,
      name: body.name !== undefined ? String(body.name) : undefined,
      password: password && password.length > 0 ? password : undefined,
      role,
      active: body.active !== undefined ? Boolean(body.active) : undefined,
    });

    if (!current) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json(sanitizeUser(current));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar usuario";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    if (id === session.id) {
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
    }

    const { findUserById } = await import("@/lib/users/repository");
    const target = await findUserById(id);
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (target.role === "admin" && target.active) {
      const admins = await countActiveAdmins(id);
      if (admins === 0) {
        return NextResponse.json(
          { error: "No se puede eliminar el último administrador activo" },
          { status: 400 },
        );
      }
    }

    const deleted = await deleteUser(id);
    if (!deleted) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
