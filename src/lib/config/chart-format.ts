/** Montos exactos en ejes de gráficos (sin abreviar K/M). */
export function formatChartAxisSoles(value: number): string {
  return value.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatChartAxisSolesWithPrefix(value: number): string {
  return `S/ ${formatChartAxisSoles(value)}`;
}

/** Monto exacto con decimales (tooltips / hover). */
export function formatChartSolesExact(value: number): string {
  return `S/ ${value.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** tickformat Plotly: separador de miles, 2 decimales. */
export const PLOTLY_SOLES_TICKFORMAT = ",.2f";
