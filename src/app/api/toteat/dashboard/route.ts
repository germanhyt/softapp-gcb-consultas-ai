import { NextRequest, NextResponse } from "next/server";
import { getToteatDashboardData } from "@/lib/toteat/dashboard-data";
import { resolveToteatRestaurant } from "@/lib/toteat/restaurants-config";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseHourParam(value: string | null): number | null {
  if (value === null || value === "") return null;
  const h = Number(value);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  return h;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const curYear = new Date().getFullYear();
  const startDate = sp.get("start_date") || `${curYear}-01-01`;
  const endDate = sp.get("end_date") || `${curYear}-12-31`;
  const restaurantId = sp.get("restaurant");
  const hourFrom = parseHourParam(sp.get("hour_from"));
  const hourTo = parseHourParam(sp.get("hour_to"));

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  if (sp.get("hour_from") && hourFrom === null) {
    return NextResponse.json({ error: "hour_from inválido (0-23)" }, { status: 400 });
  }
  if (sp.get("hour_to") && hourTo === null) {
    return NextResponse.json({ error: "hour_to inválido (0-23)" }, { status: 400 });
  }
  if (!resolveToteatRestaurant(restaurantId)) {
    return NextResponse.json(
      {
        error:
          "No hay restaurantes Toteat configurados. Define TOTEAT_RESTAURANTS_JSON o TOTEAT_XIR/TOTEAT_XIL/TOTEAT_XIU/TOTEAT_XAPITOKEN.",
      },
      { status: 500 },
    );
  }

  try {
    const data = await getToteatDashboardData({
      startDate,
      endDate,
      restaurantId,
      hourFrom,
      hourTo,
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[toteat/dashboard] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
