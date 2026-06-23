/** Reporte de ventas Toteat usado en el proyecto (actualmente solo Bar Refugio). */
export const TOTEAT_SALES_REPORT_NAME = "Bar Refugio";

export function getToteatSalesReportName(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env.TOTEAT_SALES_REPORT_NAME
      ? process.env.TOTEAT_SALES_REPORT_NAME.trim()
      : "";
  return fromEnv || TOTEAT_SALES_REPORT_NAME;
}

export function getToteatSalesReportLabel(): string {
  return `Reporte de ventas ${getToteatSalesReportName()}`;
}

/** Nota para reportes markdown y contexto IA. */
export function getToteatSourceDescription(): string {
  return (
    `Todos los datos Toteat de este sistema corresponden al **${getToteatSalesReportLabel()}** ` +
    `extraído de Toteat (API \`/sales\` + cancelaciones). El cruce interno Refugio / Sisa / Limanesas ` +
    `se calcula sobre esas ventas a partir de \`products[].payed\` por línea.`
  );
}

/** Una línea para CSV o metadatos. */
export function getToteatSourceNoteShort(): string {
  return `${getToteatSalesReportLabel()} (API Toteat /sales)`;
}
