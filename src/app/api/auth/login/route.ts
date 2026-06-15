import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthEnabled } from "@/lib/auth/config";
import { authenticateUser } from "@/lib/users/repository";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(req: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: "Autenticación deshabilitada (DATABASE_URL no configurado)." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const token = await createSessionToken(user);
    const jar = await cookies();
    jar.set(sessionCookieOptions(token));

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al iniciar sesión" },
      { status: 500 },
    );
  }
}
