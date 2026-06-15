import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const jar = await cookies();
  jar.set(clearSessionCookieOptions());
  return NextResponse.json({ success: true });
}
