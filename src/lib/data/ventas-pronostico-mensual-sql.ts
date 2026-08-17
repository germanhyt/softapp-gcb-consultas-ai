import { BQ_PROJECT } from "./bigquery-client";

const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export type PronosticoScope = "establecimiento" | "locatario" | "todos_locatarios";

export interface PronosticoPeriodo {
  anio: number;
  mes: number;
  scope: PronosticoScope;
  /** Fragmento de nombre para filtrar Negocios.Descripcion (ej: "sisa"). */
  locatarioHint?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function escapeLike(s: string): string {
  return s.replace(/'/g, "''").replace(/[%_\\]/g, "\\$&");
}

/**
 * SQL determinístico para el pronóstico de ventas de un mes (establecimiento).
 *
 * Total estimado = venta real acumulada (sales_df hasta último día con datos)
 *                + SUM(Predicciones.VentasProyectadas) de días restantes.
 */
export function buildPronosticoMensualSql(anio: number, mes: number): string {
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    throw new Error(`Año inválido para pronóstico: ${anio}`);
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error(`Mes inválido para pronóstico: ${mes}`);
  }

  const ym = `${anio}-${pad(mes)}`;
  const prevDate = new Date(Date.UTC(anio, mes - 2, 1));
  const ymPrev = `${prevDate.getUTCFullYear()}-${pad(prevDate.getUTCMonth() + 1)}`;
  const mesEs = MESES_ES[mes - 1];

  return `
WITH real AS (
  SELECT
    MAX(IF(SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 7) = '${ym}',
           SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 10), NULL)) AS ultima_fecha_con_datos,
    COUNT(DISTINCT IF(SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 7) = '${ym}',
           SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 10), NULL)) AS dias_con_venta_real,
    ROUND(SUM(IF(SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 7) = '${ym}', Monto, 0)), 2) AS venta_real_acumulada,
    ROUND(SUM(IF(SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 7) = '${ymPrev}', Monto, 0)), 2) AS venta_mes_anterior
  FROM \`${BQ_PROJECT}.Ventas.sales_df\`
  WHERE SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 7) IN ('${ym}', '${ymPrev}')
),
proy AS (
  SELECT
    ROUND(SUM(p.VentasProyectadas), 2) AS venta_proyectada_restante,
    COUNTIF(p.VentasProyectadas > 0) AS dias_proyectados,
    MAX(p.FechaActualizacion) AS pronostico_actualizado
  FROM \`${BQ_PROJECT}.Ventas.Predicciones\` p, real r
  WHERE p.Anio = ${anio}
    AND p.Mes = ${mes}
    AND p.Fecha > PARSE_DATE('%Y-%m-%d', r.ultima_fecha_con_datos)
),
meta AS (
  SELECT ROUND(SUM(MontoMeta), 2) AS meta_mes
  FROM \`${BQ_PROJECT}.Ventas.MontosMeta\`
  WHERE Anio = ${anio} AND Mes = '${mesEs}'
)
SELECT
  '${mesEs} ${anio}' AS mes_analizado,
  r.ultima_fecha_con_datos,
  r.dias_con_venta_real,
  r.venta_real_acumulada,
  p.dias_proyectados,
  IFNULL(p.venta_proyectada_restante, 0) AS venta_proyectada_restante,
  ROUND(r.venta_real_acumulada + IFNULL(p.venta_proyectada_restante, 0), 2) AS venta_total_estimada_mes,
  ROUND(SAFE_DIVIDE(r.venta_real_acumulada,
        r.venta_real_acumulada + IFNULL(p.venta_proyectada_restante, 0)) * 100, 1) AS pct_avance_real,
  m.meta_mes,
  ROUND(SAFE_DIVIDE(r.venta_real_acumulada + IFNULL(p.venta_proyectada_restante, 0), m.meta_mes) * 100, 1) AS pct_cumplimiento_meta_estimado,
  r.venta_mes_anterior,
  ROUND(SAFE_DIVIDE(r.venta_real_acumulada + IFNULL(p.venta_proyectada_restante, 0) - r.venta_mes_anterior,
        r.venta_mes_anterior) * 100, 1) AS var_pct_vs_mes_anterior,
  p.pronostico_actualizado
FROM real r, proy p, meta m
`.trim();
}

/**
 * Pronóstico por locatario usando Ventas.Pronostico.Predicted_Ventas_Locatario
 * + venta real de sales_df hasta el último día con datos.
 *
 * - Si locatarioHint: un locatario (o varios que matcheen el nombre).
 * - Si no: ranking de todos los locatarios del mes.
 */
export function buildPronosticoPorLocatarioSql(
  anio: number,
  mes: number,
  locatarioHint?: string
): string {
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    throw new Error(`Año inválido para pronóstico: ${anio}`);
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error(`Mes inválido para pronóstico: ${mes}`);
  }

  const ym = `${anio}-${pad(mes)}`;
  const mesEs = MESES_ES[mes - 1];
  const inicio = `${ym}-01`;
  const finExcl = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${pad(mes + 1)}-01`;
  const hintFilter = locatarioHint
    ? `AND UPPER(n.Descripcion) LIKE '%${escapeLike(locatarioHint.toUpperCase())}%'`
    : "";

  return `
WITH corte AS (
  SELECT MAX(SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10)) AS ultima_fecha_con_datos
  FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
  WHERE SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 7) = '${ym}'
),
real_loc AS (
  SELECT
    s.CodigoNegocio,
    COALESCE(n.Descripcion, s.CodigoNegocio) AS locatario,
    COUNT(DISTINCT SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10)) AS dias_con_venta_real,
    ROUND(SUM(s.Monto), 2) AS venta_real_acumulada
  FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
  LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
    ON s.CodigoNegocio = n.CodigoNegocio
  WHERE SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 7) = '${ym}'
    ${hintFilter}
  GROUP BY 1, 2
),
proy_loc AS (
  SELECT
    p.CodigoNegocio,
    ROUND(SUM(p.Predicted_Ventas_Locatario), 2) AS venta_proyectada_restante,
    COUNTIF(IFNULL(p.Predicted_Ventas_Locatario, 0) > 0) AS dias_proyectados
  FROM \`${BQ_PROJECT}.Ventas.Pronostico\` p
  CROSS JOIN corte c
  LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
    ON p.CodigoNegocio = n.CodigoNegocio
  WHERE p.Fecha >= DATETIME '${inicio}'
    AND p.Fecha < DATETIME '${finExcl}'
    AND DATE(p.Fecha) > PARSE_DATE('%Y-%m-%d', c.ultima_fecha_con_datos)
    ${hintFilter}
  GROUP BY 1
),
meta_loc AS (
  SELECT
    m.CodigoNegocio,
    ROUND(SUM(m.MontoMeta), 2) AS meta_mes
  FROM \`${BQ_PROJECT}.Ventas.MontosMetaMicro\` m
  WHERE m.Anio = ${anio} AND m.Mes = '${mesEs}'
  GROUP BY 1
)
SELECT
  '${mesEs} ${anio}' AS mes_analizado,
  (SELECT ultima_fecha_con_datos FROM corte) AS ultima_fecha_con_datos,
  COALESCE(r.locatario, n2.Descripcion, COALESCE(r.CodigoNegocio, p.CodigoNegocio)) AS locatario,
  COALESCE(r.CodigoNegocio, p.CodigoNegocio) AS codigo_negocio,
  IFNULL(r.dias_con_venta_real, 0) AS dias_con_venta_real,
  IFNULL(r.venta_real_acumulada, 0) AS venta_real_acumulada,
  IFNULL(p.dias_proyectados, 0) AS dias_proyectados,
  IFNULL(p.venta_proyectada_restante, 0) AS venta_proyectada_restante,
  ROUND(IFNULL(r.venta_real_acumulada, 0) + IFNULL(p.venta_proyectada_restante, 0), 2) AS venta_total_estimada_mes,
  ROUND(SAFE_DIVIDE(IFNULL(r.venta_real_acumulada, 0),
        IFNULL(r.venta_real_acumulada, 0) + IFNULL(p.venta_proyectada_restante, 0)) * 100, 1) AS pct_avance_real,
  m.meta_mes,
  ROUND(SAFE_DIVIDE(
        IFNULL(r.venta_real_acumulada, 0) + IFNULL(p.venta_proyectada_restante, 0),
        m.meta_mes) * 100, 1) AS pct_cumplimiento_meta_estimado
FROM real_loc r
FULL OUTER JOIN proy_loc p
  ON r.CodigoNegocio = p.CodigoNegocio
LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n2
  ON COALESCE(r.CodigoNegocio, p.CodigoNegocio) = n2.CodigoNegocio
LEFT JOIN meta_loc m
  ON COALESCE(r.CodigoNegocio, p.CodigoNegocio) = m.CodigoNegocio
ORDER BY venta_total_estimada_mes DESC
LIMIT 50
`.trim();
}

/** Detecta preguntas de pronóstico/proyección mensual y resuelve año/mes/alcance. */
export function parsePronosticoMensual(
  message: string,
  now: Date = new Date()
): PronosticoPeriodo | null {
  const norm = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const esPronostico =
    /pronostic|proyecci|proyecta|forecast|cierre\s*de\s*mes|fin\s*de\s*mes|cuanto\s*(vamos|voy|se\s*va)\s*a\s*(vender|facturar)|estimad[oa]\s*(de\s*)?(venta|mes)/.test(
      norm
    );
  if (!esPronostico) return null;

  // Excluir preguntas de meta/presupuesto puro (no son pronóstico de ventas)
  if (/\bmeta\b|presupuesto/.test(norm) && !/pronostic|proyecci|forecast|cierre/.test(norm)) {
    return null;
  }

  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const yearMatch = norm.match(/\b(20\d{2})\b/);
  const anioExplicito = yearMatch ? parseInt(yearMatch[1]) : null;

  let anio = now.getFullYear();
  let mes = now.getMonth() + 1;
  let mesResuelto = false;

  for (let i = 0; i < meses.length; i++) {
    if (!norm.includes(meses[i])) continue;
    anio = anioExplicito ?? now.getFullYear();
    if (!anioExplicito && i > now.getMonth()) anio -= 1;
    mes = i + 1;
    mesResuelto = true;
    break;
  }

  if (
    !mesResuelto &&
    /mes\s*(actual|en\s*curso)|este\s*mes|del\s*mes\b|cierre\s*de\s*mes|fin\s*de\s*mes/.test(norm)
  ) {
    anio = now.getFullYear();
    mes = now.getMonth() + 1;
    mesResuelto = true;
  }

  if (!mesResuelto) {
    anio = now.getFullYear();
    mes = now.getMonth() + 1;
  }

  // Alcance: todos / uno / establecimiento
  const pideTodos =
    /por\s*locatario|cada\s*locatario|todos\s*los\s*locatario|ranking\s*de\s*locatario|desglose\s*por\s*(locatario|negocio)/.test(
      norm
    );

  // Nombres frecuentes (orden: más específicos primero)
  const known: Array<[RegExp, string]> = [
    [/\blimanes/i, "LIMANES"],
    [/\bsisa\b/i, "SISA"],
    [/\bbar\s*refugio\b|\brefugio\b(?!\s*gastron)/i, "REFUGIO"],
  ];
  let locatarioHint: string | undefined;
  for (const [re, hint] of known) {
    if (re.test(message)) {
      locatarioHint = hint;
      break;
    }
  }
  // "locatario X" / "negocio X"
  if (!locatarioHint) {
    const m = norm.match(
      /(?:locatario|negocio|tienda|local)\s+([a-z0-9][a-z0-9\s]{1,30}?)(?:\s+(?:en|de|del|para|este|el|la|mes|agosto|julio|pronostic|proyecci)|$)/
    );
    if (m?.[1]) locatarioHint = m[1].trim().toUpperCase();
  }

  let scope: PronosticoScope = "establecimiento";
  if (pideTodos) scope = "todos_locatarios";
  else if (locatarioHint || /\blocatario\b|\bnegocio\b/.test(norm)) {
    scope = locatarioHint ? "locatario" : "todos_locatarios";
  }

  return { anio, mes, scope, locatarioHint };
}
