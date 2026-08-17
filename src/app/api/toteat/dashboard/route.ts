import { NextRequest, NextResponse } from "next/server";
import { getToteatDashboardData, type ToteatDashboardData } from "@/lib/toteat/dashboard-data";
import { resolveToteatRestaurant } from "@/lib/toteat/restaurants-config";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RESPONSE_CACHE_TTL_MS = 20_000;
const dashboardCache = new Map<string, { data: ToteatDashboardData; expiresAt: number }>();
const inFlightByKey = new Map<string, Promise<ToteatDashboardData>>();

function parseHourParam(value: string | null): number | null {
  if (value === null || value === "") return null;
  const h = Number(value);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  return h;
}

function parseApiMode(value: string | null): "all" | "bar" | "limanesas" | "sisa" {
  if (value === "bar") return "bar";
  if (value === "limanesas") return "limanesas";
  if (value === "sisa") return "sisa";
  return "all";
}

function parseBusinessScope(value: string | null): "all" | "refugio" | "sisa" | "limanesas" {
  if (value === "refugio") return "refugio";
  if (value === "sisa") return "sisa";
  if (value === "limanesas") return "limanesas";
  return "all";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const curYear = new Date().getFullYear();
  const startDate = sp.get("start_date") || `${curYear}-01-01`;
  const endDate = sp.get("end_date") || `${curYear}-12-31`;
  const restaurantId = sp.get("restaurant");
  const hourFrom = parseHourParam(sp.get("hour_from"));
  const hourTo = parseHourParam(sp.get("hour_to"));
  const apiMode = parseApiMode(sp.get("api_mode"));
  const businessScope = parseBusinessScope(sp.get("business_scope"));
  const cacheKey = [
    startDate,
    endDate,
    restaurantId || "",
    hourFrom == null ? "" : String(hourFrom),
    hourTo == null ? "" : String(hourTo),
    apiMode,
    businessScope,
  ].join("|");

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
    const now = Date.now();
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.data);
    }

    let dataPromise = inFlightByKey.get(cacheKey);
    if (!dataPromise) {
      dataPromise = getToteatDashboardData({
        startDate,
        endDate,
        restaurantId,
        hourFrom,
        hourTo,
        apiMode,
        businessScope,
      }).finally(() => {
        inFlightByKey.delete(cacheKey);
      });
      inFlightByKey.set(cacheKey, dataPromise);
    }
    const data = await dataPromise;
    dashboardCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[toteat/dashboard] Error:", e);
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes("429") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
