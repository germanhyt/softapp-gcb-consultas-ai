/**
 * Mapeo de medios de pago desde BigQuery sales_df.
 *
 * FormaPagoModificado (verificado 2024+): TARJETA, EFECTIVO, RAPPI, PEDIDOS YA, FIDELIO.
 * Si viene vacío (~90% de filas), se clasifica FormaPago con reglas de respaldo.
 */

export type MedioPagoCategoryKey =
  | "efectivo"
  | "tarjeta"
  | "rappi"
  | "pedidosya"
  | "uber"
  | "delivery_otros"
  | "transferencia"
  | "cuponatic"
  | "fidelio";

/** Valores exactos de FormaPagoModificado en BigQuery → categoría del dashboard. */
export const FORMA_PAGO_MODIFICADO_MAP: Record<string, MedioPagoCategoryKey> = {
  TARJETA: "tarjeta",
  EFECTIVO: "efectivo",
  RAPPI: "rappi",
  "PEDIDOS YA": "pedidosya",
  PEDIDOSYA: "pedidosya",
  FIDELIO: "fidelio",
};

function formaPagoModificadoCaseSql(alias = "s"): string {
  const col = `UPPER(TRIM(${alias}.FormaPagoModificado))`;
  const whens = Object.entries(FORMA_PAGO_MODIFICADO_MAP)
    .map(([val, cat]) => `WHEN ${col} = '${val}' THEN '${cat}'`)
    .join("\n      ");
  return `CASE\n      ${whens}\n      ELSE NULL\n    END`;
}

/** Normaliza FormaPago para comparar sin tildes ni espacios extra. */
function formaPagoNormExpr(alias = "s"): string {
  return `UPPER(TRIM(REGEXP_REPLACE(NORMALIZE(${alias}.FormaPago, NFD), r'\\pM', '')))`;
}

function formaPagoFallbackCaseSql(alias = "s"): string {
  const norm = formaPagoNormExpr(alias);
  const raw = `TRIM(COALESCE(${alias}.FormaPago, ''))`;
  return `
    CASE
      WHEN ${raw} = '' OR ${norm} IN ('-', '0.0', '0') THEN NULL
      WHEN ${norm} LIKE '%VISA%'
        OR ${norm} LIKE '%MASTERCARD%'
        OR ${norm} LIKE '%CULQI%'
        OR ${norm} LIKE '%TARJETA%'
        OR ${norm} LIKE '%CREDITO%'
        OR ${norm} LIKE '%AMERICAN EXPRESS%'
        OR ${norm} LIKE '%DINERS%'
        OR ${norm} = 'CREDITO1'
        OR ${norm} = 'TC3'
      THEN 'tarjeta'
      WHEN ${norm} = 'EFECTIVO'
        OR ${norm} LIKE '%YAPE%'
        OR ${norm} LIKE '%PLIN%'
        OR ${norm} = 'QR'
        OR ${norm} LIKE 'PUNTO DE VENTA%'
        OR ${norm} = 'CONTRAENTREGA'
      THEN 'efectivo'
      WHEN ${norm} LIKE '%RAPPI%'
        OR ${norm} LIKE 'TRANSF. RAPPI%'
        OR ${norm} LIKE 'TRANSFERENCIA RAPPI%'
      THEN 'rappi'
      WHEN ${norm} LIKE '%PEDIDOS%'
        OR ${norm} LIKE 'TRANSF PEYA%'
        OR ${norm} LIKE 'TRANSFERENCIA PEDIDOS%'
      THEN 'pedidosya'
      WHEN ${norm} LIKE '%UBER%'
      THEN 'uber'
      WHEN ${norm} LIKE '%TRANSFERENCIA%'
        OR ${norm} LIKE 'DEPOSITO%'
        OR ${norm} LIKE 'DEPOSITO BANCARIO%'
      THEN 'transferencia'
      WHEN ${norm} LIKE '%CUPONATIC%'
        OR ${norm} LIKE '%VALE DE CONSUMO%'
        OR ${norm} LIKE '%TICKET RESTAURANT%'
        OR ${norm} = 'CONVENIO'
      THEN 'cuponatic'
      WHEN ${norm} LIKE '%FIDELIO%'
      THEN 'fidelio'
      WHEN ${norm} LIKE '%MERCADOPAGO%'
        OR ${norm} IN ('MIX', 'MIXTO', 'PAGO MIXTO', 'MACH')
      THEN 'delivery_otros'
      ELSE NULL
    END
  `;
}

export const VENTAS_MEDIO_PAGO_CASE_SQL = `
  CASE
    WHEN NULLIF(TRIM(s.FormaPagoModificado), '') IS NOT NULL
    THEN (${formaPagoModificadoCaseSql()})
    ELSE (${formaPagoFallbackCaseSql()})
  END
`;
