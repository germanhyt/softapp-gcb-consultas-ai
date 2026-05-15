import { NextRequest, NextResponse } from "next/server";
import { executeBigQuery, BQ_PROJECT } from "@/lib/data/bigquery-client";
import { getCuadreTarjetasClient } from "@/lib/data/cuadre-tarjetas-client";
import { getMediosPago, aggregateByCategory } from "@/lib/config/column-rules";

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function monthLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MONTHS_ES[(m || 1) - 1]} ${y}`;
}

// ─── Canal detection ──────────────────────────────────────────────────────────
// Edit only this block when canal rules change.
// Delivery sub-channels:  Rappi | PedidosYa | UberEats
// Ventas web:             Fidelio
// Pago Link:              Pago Link (sin Eventos)
// Eventos:                Eventos (canal propio)
// Llevar:                 Llevar (para go)
// Cuponatic:              Cuponatic (SISA)
// Bosque Mágico:          Bosque Mágico (Limanesas)
// Default (presencial):   Salón
const CANAL_CASE = `
  CASE
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%RAPPI%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%RAPPI%'
    THEN 'Rappi'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%PEDIDOSYA%'
      OR UPPER(COALESCE(s.Cliente, '')) LIKE '%PEDIDOS YA%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%PEDIDOSYA%'
    THEN 'PedidosYa'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%UBER%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%UBER%'
    THEN 'UberEats'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%FIDELIO%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%FIDELIO%'
    THEN 'Fidelio'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%PAGO LINK%'
      OR UPPER(COALESCE(s.Cliente, '')) LIKE '%PAGOLINK%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%PAGO LINK%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%PAGOLINK%'
    THEN 'Pago Link'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%EVENTOS%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%EVENTOS%'
    THEN 'Eventos'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%CUPONATIC%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%CUPONATIC%'
    THEN 'Cuponatic'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%BOSQUE%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%BOSQUE%'
    THEN 'Bosque Mágico'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%LLEVAR%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%LLEVAR%'
      OR UPPER(COALESCE(s.Cliente, '')) LIKE '%PARA LLEVAR%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%PARA LLEVAR%'
    THEN 'Llevar'
    ELSE 'Salón'
  END
`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // ── Date range (required) ─────────────────────────────────────────────────
  const curYear = new Date().getFullYear();
  const startDate = sp.get("start_date") || `${curYear}-01-01`;
  const endDate = sp.get("end_date") || `${curYear}-12-31`;

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  // ── Optional filters ──────────────────────────────────────────────────────
  const turnoRaw = sp.get("turno");
  const turno = turnoRaw ? turnoRaw.replace(/'/g, "''") : null;      // SQL-safe
  const diasRaw = sp.get("dias_semana");                                // "2,3,4,5,6"
  const diasBQ: number[] = diasRaw
    ? diasRaw.split(",").map(Number).filter((n) => n >= 1 && n <= 7)
    : [];
  const negociosRaw = sp.get("negocios");                                   // "Bar,SISA,Limanesas"
  const negociosList: string[] = negociosRaw
    ? negociosRaw.split(",").map((n) => n.trim()).filter(Boolean)
    : [];
  const negociosFilter = negociosList.length > 0
    ? `AND COALESCE(n.Descripcion, s.CodigoNegocio) IN (${negociosList.map((n) => `'${n.replace(/'/g, "''")}'`).join(",")})`
    : "";

  const year = parseInt(startDate.slice(0, 4));

  // ── Determine if date range is a single month (for TOTEAT pass-through) ──
  const startM = startDate.slice(0, 7); // YYYY-MM
  const endM = endDate.slice(0, 7);
  const singleMonth = startM === endM ? parseInt(startDate.slice(5, 7)) : undefined;

  try {
    // ── 1. BigQuery: ventas × negocio × canal ─────────────────────────────
    const salesSql = `
      SELECT
        SUBSTR(s.Fecha, 1, 7)                              AS mes,
        s.CodigoNegocio,
        COALESCE(n.Descripcion, s.CodigoNegocio)           AS negocio_nombre,
        (${CANAL_CASE})                                    AS canal,
        ROUND(SUM(s.Monto), 2)                             AS total_ventas
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
        ON s.CodigoNegocio = n.CodigoNegocio
      WHERE s.Fecha >= '${startDate}'
        AND s.Fecha <= '${endDate}'
        ${turno ? `AND TRIM(UPPER(s.Turno)) = TRIM(UPPER('${turno}'))` : ""}
        ${diasBQ.length > 0 ? `AND EXTRACT(DAYOFWEEK FROM DATE(s.Fecha)) IN (${diasBQ.join(",")})` : ""}
        ${negociosFilter}
      GROUP BY mes, s.CodigoNegocio, negocio_nombre, canal
      ORDER BY mes, negocio_nombre, canal
    `;

    // ── 2. BigQuery: presupuesto × negocio (annual, not affected by sub-filters) ─
    const budgetSql = `
      SELECT
        p.CodigoNegocio,
        COALESCE(n.Descripcion, p.CodigoNegocio)  AS negocio_nombre,
        p.YearMes                                  AS mes,
        ROUND(SUM(p.Venta), 2)                     AS presupuesto
      FROM \`${BQ_PROJECT}.Ventas.Presupuesto\` p
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
        ON p.CodigoNegocio = n.CodigoNegocio
      WHERE p.Anio_Presupuesto = '${year}'
        AND p.YearMes >= '${startM}'
        AND p.YearMes <= '${endM}'
      GROUP BY p.CodigoNegocio, negocio_nombre, p.YearMes
    `;

    // ── 3. TOTEAT: propinas + medios de pago ─────────────────────────────
    const [salesResult, budgetResult, toteatResult] = await Promise.all([
      executeBigQuery(salesSql),
      executeBigQuery(budgetSql).catch((e) => { console.error("[ventas] Budget query failed:", e); return { rows: [] as Record<string, unknown>[] }; }),
      getCuadreTarjetasClient().getDashboardVentas(year, singleMonth).catch(() => null),
    ]);

    // Budget map: mes → negocio_nombre → presupuesto
    const budgetMap: Record<string, Record<string, number>> = {};
    for (const row of budgetResult.rows) {
      const mes = String(row.mes || "");
      const neg = String(row.negocio_nombre || row.CodigoNegocio || "");
      const pres = Number(row.presupuesto || 0);
      if (!mes || !neg) continue;
      if (!budgetMap[mes]) budgetMap[mes] = {};
      budgetMap[mes][neg] = (budgetMap[mes][neg] || 0) + pres;
    }

    // TOTEAT map: mes → negocio_lower → colStats
    const toteatMap: Record<string, Record<string, Record<string, number>>> = {};
    if (toteatResult) {
      for (const tm of toteatResult.months) {
        toteatMap[tm.month] = {};
        for (const [neg, colStats] of Object.entries(tm.negocios)) {
          toteatMap[tm.month][neg.toLowerCase()] = colStats;
        }
      }
    }

    // Monthly aggregation
    const monthlyMap: Record<string, {
      negocios: Record<string, {
        total: number; presupuesto?: number; canales: Record<string, number>;
        propinas?: number; medios_pago?: Record<string, number>;
      }>;
      total: number;
      presupuesto?: number;
    }> = {};

    for (const row of salesResult.rows) {
      const mes = String(row.mes || "");
      const neg = String(row.negocio_nombre || row.CodigoNegocio || "Sin Nombre");
      const canal = String(row.canal || "Salón");
      const amount = Number(row.total_ventas || 0);
      if (!mes) continue;

      if (!monthlyMap[mes]) monthlyMap[mes] = { negocios: {}, total: 0 };
      if (!monthlyMap[mes].negocios[neg]) monthlyMap[mes].negocios[neg] = { total: 0, canales: {} };

      monthlyMap[mes].negocios[neg].canales[canal] =
        Math.round(((monthlyMap[mes].negocios[neg].canales[canal] || 0) + amount) * 100) / 100;
      monthlyMap[mes].negocios[neg].total =
        Math.round((monthlyMap[mes].negocios[neg].total + amount) * 100) / 100;
      monthlyMap[mes].total =
        Math.round((monthlyMap[mes].total + amount) * 100) / 100;
    }

    // Apply budgets
    for (const [mes, monthData] of Object.entries(monthlyMap)) {
      const budgets = budgetMap[mes];
      if (!budgets) continue;
      let monthBudgetTotal = 0;
      for (const [neg, negData] of Object.entries(monthData.negocios)) {
        if (budgets[neg]) {
          negData.presupuesto = budgets[neg];
          monthBudgetTotal += budgets[neg];
        }
      }
      if (monthBudgetTotal > 0) monthData.presupuesto = Math.round(monthBudgetTotal * 100) / 100;
    }

    // Merge TOTEAT propinas + medios_pago
    for (const [mes, monthData] of Object.entries(monthlyMap)) {
      const toteatMonth = toteatMap[mes];
      if (!toteatMonth) continue;
      for (const [neg, negData] of Object.entries(monthData.negocios)) {
        const colStats = toteatMonth[neg.toLowerCase()];
        if (colStats) {
          const mp = getMediosPago(colStats);
          negData.propinas = mp.propinas;
          negData.medios_pago = aggregateByCategory(colStats);
        }
      }
    }

    const months = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, data]) => ({
        month: mes,
        label: monthLabel(mes),
        negocios: data.negocios,
        total: data.total,
        presupuesto: data.presupuesto,
      }));

    const year_total = Math.round(months.reduce((s, m) => s + m.total, 0) * 100) / 100;
    const year_presupuesto = months.reduce((s, m) => s + (m.presupuesto || 0), 0);
    const year_propinas = months.reduce((s, m) =>
      s + Object.values(m.negocios).reduce((ns, nd) => ns + (nd.propinas || 0), 0), 0);

    return NextResponse.json({
      start_date: startDate,
      end_date: endDate,
      months,
      year_total,
      year_presupuesto: year_presupuesto > 0 ? Math.round(year_presupuesto * 100) / 100 : undefined,
      year_propinas: year_propinas > 0 ? Math.round(year_propinas * 100) / 100 : undefined,
    });
  } catch (e) {
    console.error("[dashboard/ventas] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
