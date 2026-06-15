import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import { authErrorResponse, requireAuth } from "@/lib/auth/guard";

export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({
      enabled: false,
      user: { id: "dev", email: "dev@local", name: "Desarrollo", role: "admin" },
    });
  }

  try {
    const user = await requireAuth("viewer");
    return NextResponse.json({ enabled: true, user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
