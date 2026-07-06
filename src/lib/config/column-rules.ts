/**
 * column-rules.ts
 *
 * ÚNICO ARCHIVO a editar cuando cambien las reglas de categorización de columnas TOTEAT
 * o de detección de negocio por nombre de archivo.
 *
 * Agregar un canal nuevo = añadir una entrada a COLUMN_CATEGORIES.
 * Cambiar qué columnas son "Tarjeta" = editar la lista columns[].
 * Cambiar cómo se detecta un negocio = editar NEGOCIO_RULES.
 * Sin impacto en componentes UI ni en el backend.
 */

export interface CategoryDef {
  label: string;
  columns: string[];
  color: string;
}

export const COLUMN_CATEGORIES: Record<string, CategoryDef> = {
  ventas:         { label: "Ventas Totales",  columns: ["Boleta"],                                                                                                            color: "#10b981" },
  efectivo:       { label: "Efectivo",        columns: ["Efectivo"],                                                                                                          color: "#f59e0b" },
  tarjeta:        { label: "Tarjeta",         columns: ["VISA Crédito", "Mastercard Crédito", "Tarjeta Crédito", "Credito1", "TC3", "American Express", "Diners Club", "Tarjeta Débito"], color: "#3b82f6" },
  rappi:          { label: "Rappi",           columns: ["Rappi", "Rappi Pay", "Transf. Rappi", "Transferencia Rappi"],                                                        color: "#ef4444" },
  pedidosya:      { label: "PedidosYa",       columns: ["PedidosYa", "PedidosYa Vouchers", "Transf Peya", "Transferencia Pedidos Ya"],                                       color: "#f97316" },
  uber:           { label: "UberEats",        columns: ["UberEats"],                                                                                                          color: "#84cc16" },
  delivery_otros: { label: "Delivery Otros",  columns: ["MercadoPago QR", "MercadoPago Checkout", "MACH", "Chek Ripley Pasarela", "FPay QR Statico"],                        color: "#6366f1" },
  transferencia:  { label: "Transferencia",   columns: ["Transferencia"],                                                                                                     color: "#8b5cf6" },
  cuponatic:      { label: "Cuponatic",       columns: ["Cuponatic", "Vale de consumo", "Ticket Restaurant", "Cheque Restaurant"],                                            color: "#14b8a6" },
  fidelio:        { label: "Fidelio",         columns: [],                                                                                                                    color: "#22d3ee" },
  propinas:       { label: "Propinas",        columns: ["Propina"],                                                                                                           color: "#ec4899" },
  descuentos:     { label: "Descuentos",      columns: ["Descuentos"],                                                                                                        color: "#6b7280" },
};

/** Delivery categories for grouping in charts */
export const DELIVERY_CATEGORIES = ["rappi", "pedidosya", "uber", "delivery_otros"];

/** Categories to show in the medio-de-pago pie chart (excluding ventas/descuentos) */
export const MEDIO_PAGO_CATEGORIES = ["efectivo", "tarjeta", "rappi", "pedidosya", "uber", "delivery_otros", "transferencia", "cuponatic", "fidelio"];

/** Negocio detection rules — order matters (first match wins) */
export const NEGOCIO_RULES = [
  { pattern: /limanesas/i,  negocio: "Limanesas" },
  { pattern: /sisa/i,       negocio: "SISA" },
  { pattern: /bar/i,        negocio: "Bar" },
];

/**
 * BigQuery usa nombres distintos a CuadreTarjetas/TOTEAT (p. ej. "Bar Refugio" vs "Bar").
 * Claves en minúsculas → posibles claves en toteatMap (también en minúsculas).
 */
export const BQ_TOTEAT_NEGOCIO_ALIASES: Record<string, string[]> = {
  "bar refugio": ["bar", "refugio"],
  "sisa cafe": ["sisa"],
  "sisa": ["sisa"],
  "limanesas": ["limanesas"],
};

/** Busca stats TOTEAT para un negocio de BigQuery dentro del mapa mensual. */
export function resolveToteatNegocioStats(
  bqNegocio: string,
  toteatMonth: Record<string, Record<string, number>>,
): Record<string, number> | undefined {
  const normalized = bqNegocio.toLowerCase().trim();
  if (toteatMonth[normalized]) return toteatMonth[normalized];

  for (const alias of BQ_TOTEAT_NEGOCIO_ALIASES[normalized] || []) {
    if (toteatMonth[alias]) return toteatMonth[alias];
  }

  for (const [key, stats] of Object.entries(toteatMonth)) {
    if (normalized.includes(key) || key.includes(normalized)) return stats;
  }

  return undefined;
}

/** Suma dos mapas de medios de pago (categorías aggregateByCategory). */
export function mergeMediosPagoMaps(
  base: Record<string, number> | undefined,
  add: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = { ...base };
  for (const [k, v] of Object.entries(add)) {
    result[k] = Math.round(((result[k] || 0) + v) * 100) / 100;
  }
  return result;
}

/**
 * Aggregates raw column stats { "Boleta": 167255, "Propina": 2226, ... }
 * into category totals { ventas: 167255, propinas: 2226, tarjeta: 144904, ... }
 */
export function aggregateByCategory(colStats: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [catKey, catDef] of Object.entries(COLUMN_CATEGORIES)) {
    let total = 0;
    for (const col of catDef.columns) {
      total += colStats[col] || 0;
    }
    result[catKey] = Math.round(total * 100) / 100;
  }
  return result;
}

/** Sum of all delivery sub-categories */
export function getDeliveryTotal(aggregated: Record<string, number>): number {
  return DELIVERY_CATEGORIES.reduce((sum, cat) => sum + (aggregated[cat] || 0), 0);
}

/** Format as Peruvian soles */
export function formatSoles(amount: number): string {
  return `S/ ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Short format for large numbers in charts (e.g. 1,250,000 → "1.25M") */
export function formatSolesShort(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(0)}K`;
  return `S/ ${amount.toFixed(0)}`;
}

/**
 * Extracts medios de pago from raw TOTEAT column stats.
 * Returns { efectivo, tarjeta, otros } — delivery channels counted in "otros".
 */
export function getMediosPago(colStats: Record<string, number>): {
  efectivo: number; tarjeta: number; propinas: number; otros: number;
} {
  const efectivo  = colStats["Efectivo"] || 0;
  const propinas  = colStats["Propina"]  || 0;
  const tarjeta   = COLUMN_CATEGORIES.tarjeta.columns
    .reduce((s, c) => s + (colStats[c] || 0), 0);
  const EXCLUDE   = new Set([
    "Boleta", "Propina", "Descuentos", "Efectivo",
    ...COLUMN_CATEGORIES.tarjeta.columns,
  ]);
  const otros     = Object.entries(colStats)
    .filter(([col]) => !EXCLUDE.has(col))
    .reduce((s, [, v]) => s + v, 0);
  return {
    efectivo: Math.round(efectivo * 100) / 100,
    tarjeta:  Math.round(tarjeta  * 100) / 100,
    propinas: Math.round(propinas * 100) / 100,
    otros:    Math.round(otros    * 100) / 100,
  };
}
