/**
 * Conteo de transacciones en sales_df:
 * - CodigoTransaccion válido (no vacío, no "-") → COUNT(DISTINCT)
 * - Sin código válido → SUM(Cantidad), default 1 por fila
 */

/** Expresión booleana: el código identifica una transacción real. */
export const VENTAS_CODIGO_TRANSACCION_VALIDO_SQL = `
  TRIM(COALESCE(s.CodigoTransaccion, '')) != ''
  AND TRIM(s.CodigoTransaccion) != '-'
`;

export const VENTAS_TRANSACCIONES_SQL = `
  COUNT(DISTINCT CASE
    WHEN ${VENTAS_CODIGO_TRANSACCION_VALIDO_SQL}
    THEN s.CodigoTransaccion
  END)
  + SUM(CASE
    WHEN NOT (${VENTAS_CODIGO_TRANSACCION_VALIDO_SQL})
    THEN COALESCE(s.Cantidad, 1)
    ELSE 0
  END)
`;
