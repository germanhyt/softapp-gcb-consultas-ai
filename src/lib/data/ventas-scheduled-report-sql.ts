import { BQ_PROJECT } from "./bigquery-client";
import { VENTAS_CANAL_CASE_SQL } from "./ventas-canal-case-sql";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * SQL determinístico para reportes programados con [VENTAS_RANGO_ISO:..].
 * Filtro de fecha alineado al dashboard: SUBSTR(TRIM(CAST(Fecha AS STRING)),1,10)
 * (evita fallos cuando LEFT(Fecha,10) no coincide por espacios o formatos mixtos).
 */
export function buildVentasScheduledReportSql(startIso: string, endIso: string): string {
  if (!YMD_RE.test(startIso) || !YMD_RE.test(endIso)) {
    throw new Error("Rango ISO inválido para SQL de ventas");
  }
  const s = startIso.replace(/'/g, "''");
  const e = endIso.replace(/'/g, "''");

  return `
SELECT
  COALESCE(c.Categoria, 'Sin Categoria') AS categoria_producto,
  (${VENTAS_CANAL_CASE_SQL.trim()}) AS canal,
  ROUND(SUM(s.Monto), 2) AS total_ventas
FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
LEFT JOIN \`${BQ_PROJECT}.Ventas.Categorias\` c
  ON s.Producto = c.Producto
WHERE SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10) >= '${s}'
  AND SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10) <= '${e}'
GROUP BY 1, 2
ORDER BY total_ventas DESC
LIMIT 200
`.trim();
}
