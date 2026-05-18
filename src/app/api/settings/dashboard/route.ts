import { NextResponse } from "next/server";
import {
  readDashboardConfig,
  writeDashboardConfig,
  type DashboardConfig,
} from "@/lib/config/dashboard-config";

/** GET — preferencias del dashboard (ej. ocultar negocios sin ventas). */
export async function GET() {
  try {
    const config = readDashboardConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("[Settings dashboard] GET:", error);
    return NextResponse.json(
      { error: "Error al leer configuración" },
      { status: 500 },
    );
  }
}

/** POST — body: { hideNegociosSinVentas?: boolean } */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<DashboardConfig>;
    const current = readDashboardConfig();
    const next: DashboardConfig = {
      hideNegociosSinVentas:
        typeof body.hideNegociosSinVentas === "boolean"
          ? body.hideNegociosSinVentas
          : current.hideNegociosSinVentas,
    };
    writeDashboardConfig(next);
    return NextResponse.json(next);
  } catch (error) {
    console.error("[Settings dashboard] POST:", error);
    const message = error instanceof Error ? error.message : "Error al guardar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
