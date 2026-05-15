import { NextRequest, NextResponse } from "next/server";
import { getCuadreTarjetasClient } from "@/lib/data/cuadre-tarjetas-client";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const instanceId = sp.get("instancia");

  if (!instanceId || isNaN(Number(instanceId))) {
    return NextResponse.json({ error: "Se requiere ?instancia=ID" }, { status: 400 });
  }

  const id = Number(instanceId);
  const client = getCuadreTarjetasClient();

  try {
    const [dailySummaries, monthlyOverview, methodStats] = await Promise.allSettled([
      client.getDailySummaries(id),
      client.getMonthlyOverview(id),
      client.getMethodStatistics(id),
    ]);

    // API responses may be paginated objects { count, results } — extract the array
    const extractArray = (val: unknown): unknown[] => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object" && "results" in val && Array.isArray((val as { results: unknown[] }).results)) {
        return (val as { results: unknown[] }).results;
      }
      return [];
    };

    // Map API field names → frontend expected names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapDailySummary = (raw: any) => {
      const toteatTotal = Number(raw.toteat_amount ?? 0);
      const matchedAmt  = Number(raw.matched_amount ?? 0);
      const diff        = Number(raw.amount_difference ?? (toteatTotal - matchedAmt));
      // status_indicator may be an object { icon, label, color } or a string
      const rawStatus = raw.status_indicator;
      const statusStr = typeof rawStatus === "object" && rawStatus?.label
        ? String(rawStatus.label)
        : typeof rawStatus === "string" ? rawStatus : undefined;
      return {
        id:                  raw.id,
        date:                raw.operational_date,
        date_display:        raw.operational_date_display,
        toteat_total:        toteatTotal,
        toteat_conciliated:  matchedAmt,
        payment_matched:     matchedAmt,
        difference:          diff,
        surplus:             diff > 0 ? diff : 0,
        shortage:            diff < 0 ? Math.abs(diff) : 0,
        tips:                0,
        toteat_count:        raw.toteat_count ?? 0,
        matched_count:       raw.matched_count ?? 0,
        unmatched_count:     raw.unmatched_toteat_count ?? 0,
        match_rate:          raw.match_rate ?? 0,
        status:              statusStr,
      };
    };

    // Map monthly_overview API fields → frontend expected fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapMonthlyOverview = (raw: any): Record<string, unknown> | null => {
      if (!raw || typeof raw !== "object") return null;
      // The API returns: total_days, avg_match_rate, days_excellent, daily_trend, etc.
      // The frontend expects: total_ventas, total_conciliado, cuadre_pct, etc.
      // Compute from daily_trend if available
      const trend = Array.isArray(raw.daily_trend) ? raw.daily_trend : [];
      const totalVentas     = trend.reduce((s: number, d: any) => s + Number(d.toteat_amount ?? 0), 0);
      const totalConciliado = trend.reduce((s: number, d: any) => s + Number(d.matched_amount ?? 0), 0);
      const totalDiferencia = trend.reduce((s: number, d: any) => s + Number(d.amount_difference ?? 0), 0);
      const diasTotales     = raw.total_days ?? trend.length;
      const diasCuadrados   = trend.filter((d: any) => Math.abs(Number(d.amount_difference ?? 0)) < 0.5).length;
      const cuadrePct       = diasTotales > 0 ? (diasCuadrados / diasTotales) * 100 : 0;
      return {
        total_ventas:     totalVentas,
        total_conciliado: totalConciliado,
        total_diferencia: totalDiferencia,
        cuadre_pct:       cuadrePct,
        dias_cuadrados:   diasCuadrados,
        dias_totales:     diasTotales,
        avg_match_rate:   raw.avg_match_rate,
      };
    };

    // Map method-statistics API response → frontend MethodStat[]
    // API returns { summary: { total_matches }, by_method: [{ method, label, count, percentage }] }
    // Frontend expects [{ method, matched, total, pct }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapMethodStats = (raw: any): Array<{ method: string; matched: number; total: number; pct: number }> => {
      if (!raw || typeof raw !== "object") return [];
      const methods = Array.isArray(raw.by_method) ? raw.by_method : [];
      const totalMatches = Number(raw.summary?.total_matches ?? 0);
      return methods.map((m: any) => ({
        method: m.label || m.method || "Desconocido",
        matched: Number(m.count ?? 0),
        total: totalMatches,
        pct: Number(m.percentage ?? 0),
      }));
    };

    const rawDays = dailySummaries.status === "fulfilled" ? extractArray(dailySummaries.value) : [];

    return NextResponse.json({
      instancia_id: id,
      daily_summaries: rawDays.map(mapDailySummary),
      monthly_overview: monthlyOverview.status === "fulfilled" ? mapMonthlyOverview(monthlyOverview.value) : null,
      method_stats: methodStats.status === "fulfilled" ? mapMethodStats(methodStats.value) : [],
    });
  } catch (e) {
    console.error("[auditoria] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
