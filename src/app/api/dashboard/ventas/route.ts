import { NextRequest, NextResponse } from "next/server";
import { executeBigQuery, BQ_PROJECT } from "@/lib/data/bigquery-client";
import { VENTAS_CANAL_CASE_SQL } from "@/lib/data/ventas-canal-case-sql";
import { VENTAS_MEDIO_PAGO_CASE_SQL } from "@/lib/data/ventas-medio-pago-case-sql";
import { VENTAS_TRANSACCIONES_SQL } from "@/lib/data/ventas-transacciones-sql";

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function monthLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MONTHS_ES[(m || 1) - 1]} ${y}`;
}

function safeTicket(total: number, transacciones: number): number | undefined {
  if (transacciones <= 0) return undefined;
  return Math.round((total / transacciones) * 100) / 100;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const curYear = new Date().getFullYear();
  const startDate = sp.get("start_date") || `${curYear}-01-01`;
  const endDate = sp.get("end_date") || `${curYear}-12-31`;

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const turnoRaw = sp.get("turno");
  const turno = turnoRaw ? turnoRaw.replace(/'/g, "''") : null;
  const diasRaw = sp.get("dias_semana");
  const diasBQ: number[] = diasRaw
    ? diasRaw.split(",").map(Number).filter((n) => n >= 1 && n <= 7)
    : [];
  const negociosRaw = sp.get("negocios");
  const negociosList: string[] = negociosRaw
    ? negociosRaw.split(",").map((n) => n.trim()).filter(Boolean)
    : [];
  const negociosFilter = negociosList.length > 0
    ? `AND COALESCE(n.Descripcion, s.CodigoNegocio) IN (${negociosList.map((n) => `'${n.replace(/'/g, "''")}'`).join(",")})`
    : "";

  const year = parseInt(startDate.slice(0, 4));
  const startM = startDate.slice(0, 7);
  const endM = endDate.slice(0, 7);

  const baseWhere = `
    WHERE s.Fecha >= '${startDate}'
      AND s.Fecha <= '${endDate}'
      ${turno ? `AND TRIM(UPPER(s.Turno)) = TRIM(UPPER('${turno}'))` : ""}
      ${diasBQ.length > 0 ? `AND EXTRACT(DAYOFWEEK FROM DATE(s.Fecha)) IN (${diasBQ.join(",")})` : ""}
      ${negociosFilter}
  `;

  try {
    const salesSql = `
      SELECT
        SUBSTR(s.Fecha, 1, 7)                              AS mes,
        s.CodigoNegocio,
        COALESCE(n.Descripcion, s.CodigoNegocio)           AS negocio_nombre,
        (${VENTAS_CANAL_CASE_SQL})                         AS canal,
        ROUND(SUM(s.Monto), 2)                             AS total_ventas
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
        ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
      GROUP BY mes, s.CodigoNegocio, negocio_nombre, canal
      ORDER BY mes, negocio_nombre, canal
    `;

    const transaccionesSql = `
      SELECT
        SUBSTR(s.Fecha, 1, 7)                              AS mes,
        COALESCE(n.Descripcion, s.CodigoNegocio)           AS negocio_nombre,
        (${VENTAS_TRANSACCIONES_SQL})                      AS transacciones,
        ROUND(SUM(s.Monto), 2)                             AS total_ventas
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
        ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
      GROUP BY mes, negocio_nombre
      ORDER BY mes, negocio_nombre
    `;

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

    const mediosPagoSql = `
      SELECT
        SUBSTR(s.Fecha, 1, 7)                              AS mes,
        COALESCE(n.Descripcion, s.CodigoNegocio)           AS negocio_nombre,
        (${VENTAS_MEDIO_PAGO_CASE_SQL})                    AS medio,
        ROUND(SUM(s.Monto), 2)                             AS total
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
        ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
        AND (${VENTAS_MEDIO_PAGO_CASE_SQL}) IS NOT NULL
      GROUP BY mes, negocio_nombre, medio
      ORDER BY mes, negocio_nombre, medio
    `;

    const [salesResult, transResult, budgetResult, mediosPagoResult] = await Promise.all([
      executeBigQuery(salesSql),
      executeBigQuery(transaccionesSql),
      executeBigQuery(budgetSql).catch((e) => {
        console.error("[ventas] Budget query failed:", e);
        return { rows: [] as Record<string, unknown>[] };
      }),
      executeBigQuery(mediosPagoSql),
    ]);

    const budgetMap: Record<string, Record<string, number>> = {};
    for (const row of budgetResult.rows) {
      const mes = String(row.mes || "");
      const neg = String(row.negocio_nombre || row.CodigoNegocio || "");
      const pres = Number(row.presupuesto || 0);
      if (!mes || !neg) continue;
      if (!budgetMap[mes]) budgetMap[mes] = {};
      budgetMap[mes][neg] = (budgetMap[mes][neg] || 0) + pres;
    }

    const monthlyMap: Record<string, {
      negocios: Record<string, {
        total: number;
        presupuesto?: number;
        canales: Record<string, number>;
        transacciones?: number;
        ticket_promedio?: number;
        medios_pago?: Record<string, number>;
      }>;
      total: number;
      presupuesto?: number;
      transacciones?: number;
      ticket_promedio?: number;
    }> = {};

    for (const row of transResult.rows) {
      const mes = String(row.mes || "");
      const neg = String(row.negocio_nombre || "Sin Nombre");
      const trans = Number(row.transacciones || 0);
      const total = Number(row.total_ventas || 0);
      if (!mes) continue;

      if (!monthlyMap[mes]) monthlyMap[mes] = { negocios: {}, total: 0 };
      if (!monthlyMap[mes].negocios[neg]) {
        monthlyMap[mes].negocios[neg] = { total: 0, canales: {} };
      }
      monthlyMap[mes].negocios[neg].transacciones = trans;
      monthlyMap[mes].negocios[neg].ticket_promedio = safeTicket(total, trans);
    }

    for (const row of salesResult.rows) {
      const mes = String(row.mes || "");
      const neg = String(row.negocio_nombre || row.CodigoNegocio || "Sin Nombre");
      const canal = String(row.canal || "Salón");
      const amount = Number(row.total_ventas || 0);
      if (!mes) continue;

      if (!monthlyMap[mes]) monthlyMap[mes] = { negocios: {}, total: 0 };
      if (!monthlyMap[mes].negocios[neg]) {
        monthlyMap[mes].negocios[neg] = { total: 0, canales: {} };
      }

      monthlyMap[mes].negocios[neg].canales[canal] =
        Math.round(((monthlyMap[mes].negocios[neg].canales[canal] || 0) + amount) * 100) / 100;
      monthlyMap[mes].negocios[neg].total =
        Math.round((monthlyMap[mes].negocios[neg].total + amount) * 100) / 100;
      monthlyMap[mes].total =
        Math.round((monthlyMap[mes].total + amount) * 100) / 100;
    }

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

      let monthTrans = 0;
      for (const negData of Object.values(monthData.negocios)) {
        monthTrans += negData.transacciones || 0;
      }
      monthData.transacciones = monthTrans;
      monthData.ticket_promedio = safeTicket(monthData.total, monthTrans);
    }

    for (const row of mediosPagoResult.rows) {
      const mes = String(row.mes || "");
      const neg = String(row.negocio_nombre || "Sin Nombre");
      const medio = String(row.medio || "");
      const amount = Number(row.total || 0);
      if (!mes || !neg || !medio || amount <= 0) continue;

      if (!monthlyMap[mes]) monthlyMap[mes] = { negocios: {}, total: 0 };
      if (!monthlyMap[mes].negocios[neg]) {
        monthlyMap[mes].negocios[neg] = { total: 0, canales: {} };
      }
      if (!monthlyMap[mes].negocios[neg].medios_pago) {
        monthlyMap[mes].negocios[neg].medios_pago = {};
      }
      monthlyMap[mes].negocios[neg].medios_pago![medio] =
        Math.round(((monthlyMap[mes].negocios[neg].medios_pago![medio] || 0) + amount) * 100) / 100;
    }

    const months = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, data]) => ({
        month: mes,
        label: monthLabel(mes),
        negocios: data.negocios,
        total: data.total,
        presupuesto: data.presupuesto,
        transacciones: data.transacciones,
        ticket_promedio: data.ticket_promedio,
      }));

    const year_total = Math.round(months.reduce((s, m) => s + m.total, 0) * 100) / 100;
    const year_presupuesto = months.reduce((s, m) => s + (m.presupuesto || 0), 0);
    const year_transacciones = months.reduce((s, m) => s + (m.transacciones || 0), 0);

    return NextResponse.json({
      start_date: startDate,
      end_date: endDate,
      months,
      year_total,
      year_presupuesto: year_presupuesto > 0 ? Math.round(year_presupuesto * 100) / 100 : undefined,
      year_transacciones: year_transacciones > 0 ? year_transacciones : undefined,
      year_ticket_promedio: safeTicket(year_total, year_transacciones),
    });
  } catch (e) {
    console.error("[dashboard/ventas] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
