import { NextRequest, NextResponse } from "next/server";
import { executeBigQuery, BQ_PROJECT } from "@/lib/data/bigquery-client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DIAS_LABEL: Record<number, string> = {
  1: "Dom", 2: "Lun", 3: "Mar", 4: "Mié", 5: "Jue", 6: "Vie", 7: "Sáb",
};

const MESES_CORTO = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatDiaLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.valueOf())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function formatSemanaLabel(inicioIso: string): string {
  const start = new Date(`${inicioIso}T12:00:00`);
  if (Number.isNaN(start.valueOf())) return inicioIso;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) =>
    `${String(dt.getUTCDate()).padStart(2, "0")} ${MESES_CORTO[dt.getUTCMonth()]}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatMesLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MESES_CORTO[m - 1] ?? m} ${y}`;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const curYear   = new Date().getFullYear();
  const startDate = sp.get("start_date") || `${curYear}-01-01`;
  const endDate   = sp.get("end_date")   || `${curYear}-12-31`;

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  // ── Optional filters ──────────────────────────────────────────────────────
  const turnoRaw  = sp.get("turno");
  const turno     = turnoRaw ? turnoRaw.replace(/'/g, "''") : null;
  const diasRaw   = sp.get("dias_semana");
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

  const baseWhere = `
    WHERE s.Fecha >= '${startDate}'
      AND s.Fecha <= '${endDate}'
      ${turno ? `AND TRIM(UPPER(s.Turno)) = TRIM(UPPER('${turno}'))` : ""}
      ${diasBQ.length > 0 ? `AND EXTRACT(DAYOFWEEK FROM DATE(s.Fecha)) IN (${diasBQ.join(",")})` : ""}
      ${negociosFilter}
  `;

  try {
    // ── 1. Por Turno ─────────────────────────────────────────────────────────
    const turnoSql = `
      SELECT
        TRIM(COALESCE(s.Turno, 'Sin Turno'))   AS turno,
        ROUND(SUM(s.Monto), 2)                 AS total,
        COUNT(DISTINCT s.CodigoTransaccion)    AS transacciones
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
        AND s.Turno IS NOT NULL AND TRIM(s.Turno) != ''
      GROUP BY turno
      ORDER BY total DESC
    `;

    // ── 2. Por Día de la Semana ───────────────────────────────────────────────
    const diaSql = `
      SELECT
        EXTRACT(DAYOFWEEK FROM DATE(s.Fecha))  AS dia_num,
        ROUND(SUM(s.Monto), 2)                 AS total,
        COUNT(DISTINCT s.CodigoTransaccion)    AS transacciones
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
      GROUP BY dia_num
      ORDER BY dia_num
    `;

    // ── 3. Por Hora ───────────────────────────────────────────────────────────
    // Hora is STRING 'HH:MM:SS' — extract hour safely
    const horaSql = `
      SELECT
        SAFE_CAST(SPLIT(TRIM(s.Hora), ':')[SAFE_OFFSET(0)] AS INT64)  AS hora,
        ROUND(SUM(s.Monto), 2)                                         AS total,
        COUNT(DISTINCT s.CodigoTransaccion)                            AS transacciones
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
        AND s.Hora IS NOT NULL AND TRIM(s.Hora) != ''
      GROUP BY hora
      HAVING hora IS NOT NULL AND hora >= 0 AND hora <= 23
      ORDER BY hora
    `;

    const diaCalendarioSql = `
      SELECT
        CAST(DATE(s.Fecha) AS STRING)          AS periodo,
        ROUND(SUM(s.Monto), 2)                 AS total,
        COUNT(DISTINCT s.CodigoTransaccion)    AS transacciones
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
      GROUP BY periodo
      ORDER BY periodo
    `;

    const semanaSql = `
      SELECT
        CAST(DATE_TRUNC(DATE(s.Fecha), WEEK(MONDAY)) AS STRING) AS periodo,
        ROUND(SUM(s.Monto), 2)                                  AS total,
        COUNT(DISTINCT s.CodigoTransaccion)                     AS transacciones
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
      GROUP BY periodo
      ORDER BY periodo
    `;

    const mesSql = `
      SELECT
        FORMAT_DATE('%Y-%m', DATE(s.Fecha))     AS periodo,
        ROUND(SUM(s.Monto), 2)                 AS total,
        COUNT(DISTINCT s.CodigoTransaccion)    AS transacciones
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n ON s.CodigoNegocio = n.CodigoNegocio
      ${baseWhere}
      GROUP BY periodo
      ORDER BY periodo
    `;

    const [turnoResult, diaResult, horaResult, diaCalResult, semanaResult, mesResult] =
      await Promise.all([
      executeBigQuery(turnoSql).catch(() => ({ rows: [] })),
      executeBigQuery(diaSql).catch(() => ({ rows: [] })),
      executeBigQuery(horaSql).catch(() => ({ rows: [] })),
      executeBigQuery(diaCalendarioSql).catch(() => ({ rows: [] })),
      executeBigQuery(semanaSql).catch(() => ({ rows: [] })),
      executeBigQuery(mesSql).catch(() => ({ rows: [] })),
    ]);

    const por_turno = turnoResult.rows.map((r) => ({
      turno:         String(r.turno || "Sin Turno"),
      total:         Number(r.total || 0),
      transacciones: Number(r.transacciones || 0),
    }));

    const por_dia = diaResult.rows.map((r) => ({
      dia_num:       Number(r.dia_num),
      dia_label:     DIAS_LABEL[Number(r.dia_num)] ?? `Día ${r.dia_num}`,
      total:         Number(r.total || 0),
      transacciones: Number(r.transacciones || 0),
    }));

    const por_hora = horaResult.rows.map((r) => ({
      hora:          Number(r.hora),
      hora_label:    `${String(Number(r.hora)).padStart(2, "0")}:00`,
      total:         Number(r.total || 0),
      transacciones: Number(r.transacciones || 0),
    }));

    const mapPeriodo = (
      rows: Array<Record<string, unknown>>,
      labelFn: (p: string) => string,
    ) =>
      rows.map((r) => {
        const periodo = String(r.periodo || "");
        return {
          periodo,
          label: labelFn(periodo),
          total: Number(r.total || 0),
          transacciones: Number(r.transacciones || 0),
        };
      });

    const tendencia = {
      por_dia: mapPeriodo(diaCalResult.rows, formatDiaLabel),
      por_semana: mapPeriodo(semanaResult.rows, formatSemanaLabel),
      por_mes: mapPeriodo(mesResult.rows, formatMesLabel),
    };

    return NextResponse.json({ por_turno, por_dia, por_hora, tendencia });
  } catch (e) {
    console.error("[dashboard/charts] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
