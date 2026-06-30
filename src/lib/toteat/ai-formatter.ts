import { formatSoles } from "@/lib/config/column-rules";
import type { ToteatDashboardData } from "./dashboard-data";
import { getToteatSalesReportLabel, getToteatSourceDescription } from "./source-context";
import {
  buildToteatApiQueryString,
  type ToteatQueryFocus,
  type ToteatQueryParams,
} from "./query-parser";

function formatHourRange(hourFrom: number | null, hourTo: number | null): string {
  if (hourFrom === null && hourTo === null) return "Todo el día";
  const from = hourFrom !== null ? `${String(hourFrom).padStart(2, "0")}:00` : "00:00";
  const to = hourTo !== null ? `${String(hourTo).padStart(2, "0")}:59` : "23:59";
  if (hourFrom !== null && hourTo !== null && hourFrom > hourTo) {
    return `${from} – ${to} (Lima, cruza día)`;
  }
  return `${from} – ${to} (Lima)`;
}

function sectionFinancial(data: ToteatDashboardData): string[] {
  return [
    "### Resumen financiero",
    "",
    "| Métrica | Valor |",
    "| --- | --- |",
    `| Venta bruta | ${formatSoles(data.total_sales)} |`,
    `| Venta bruta − descuentos | ${formatSoles(data.total_sales_after_discounts)} |`,
    `| Impuestos | ${formatSoles(data.total_taxes)} |`,
    `| Venta neta | ${formatSoles(data.total_net_sales)} |`,
    `| Total pagado | ${formatSoles(data.total_paid)} |`,
    `| Descuentos | ${formatSoles(data.total_discounts)} |`,
    `| Propinas | ${formatSoles(data.total_gratuity)} |`,
    `| Órdenes | ${data.orders_count} |`,
    `| Pagos / cierres | ${data.payments_count} |`,
    `| Comensales | ${data.clients_count || "—"} |`,
    `| Ticket promedio (bruto / orden) | ${formatSoles(data.average_ticket_gross)} |`,
    `| Ticket promedio (neto / orden) | ${formatSoles(data.average_ticket_net)} |`,
    ...(data.clients_count > 0
      ? [`| Ticket promedio (bruto / comensal) | ${formatSoles(data.average_ticket_per_client)} |`]
      : []),
  ];
}

function sectionBusiness(data: ToteatDashboardData): string[] {
  const lines = [
    "### Cruce interno (Refugio / Sisa / Limanesas)",
    "",
    "| Negocio | Monto | % | Órdenes | Ticket prom. |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const b of data.business_split.by_business) {
    lines.push(
      `| ${b.business} | ${formatSoles(b.total)} | ${b.percentage}% | ${b.orders} | ${formatSoles(b.average_ticket)} |`,
    );
  }
  if (data.business_split.rules.length > 0) {
    lines.push("", "**Reglas de clasificación:**");
    for (const rule of data.business_split.rules) {
      lines.push(`- ${rule}`);
    }
  }
  return lines;
}

function sectionWaiters(data: ToteatDashboardData): string[] {
  if (data.top_waiters.length === 0) return ["### Top meseros", "", "_Sin datos de meseros en el periodo._"];
  return [
    "### Top meseros",
    "",
    "| Mesero | Ventas | Órdenes |",
    "| --- | --- | --- |",
    ...data.top_waiters.slice(0, 12).map(
      (w) => `| ${w.waiterName} | ${formatSoles(w.sales)} | ${w.orders} |`,
    ),
  ];
}

function sectionPayments(data: ToteatDashboardData): string[] {
  if (data.payment_methods.length === 0) return ["### Medios de pago", "", "_Sin datos de medios de pago._"];
  return [
    "### Medios de pago",
    "",
    "| Medio | Monto | Transacciones |",
    "| --- | --- | --- |",
    ...data.payment_methods.slice(0, 12).map(
      (m) => `| ${m.name} | ${formatSoles(m.amount)} | ${m.count} |`,
    ),
  ];
}

function sectionProducts(data: ToteatDashboardData): string[] {
  if (data.top_products.length === 0) return ["### Top productos", "", "_Sin datos de productos._"];
  return [
    "### Top productos",
    "",
    "| Producto | Cantidad | Ingreso |",
    "| --- | --- | --- |",
    ...data.top_products.slice(0, 12).map(
      (p) => `| ${p.name} | ${p.quantity} | ${formatSoles(p.revenue)} |`,
    ),
  ];
}

function sectionCharts(data: ToteatDashboardData): string[] {
  const lines: string[] = ["### Ventas por turno / día / hora", ""];
  if (data.charts.por_turno.length > 0) {
    lines.push("**Por turno:**", "| Turno | Venta | Transacciones |", "| --- | --- | --- |");
    for (const r of data.charts.por_turno) {
      lines.push(`| ${r.turno} | ${formatSoles(r.total)} | ${r.transacciones} |`);
    }
    lines.push("");
  }
  if (data.charts.por_dia.length > 0) {
    lines.push("**Por día de semana:**", "| Día | Venta | Transacciones |", "| --- | --- | --- |");
    for (const r of data.charts.por_dia) {
      lines.push(`| ${r.dia_label} | ${formatSoles(r.total)} | ${r.transacciones} |`);
    }
    lines.push("");
  }
  if (data.charts.por_hora.length > 0) {
    lines.push("**Por hora:**", "| Hora | Venta | Transacciones |", "| --- | --- | --- |");
    for (const r of data.charts.por_hora.slice(0, 24)) {
      lines.push(`| ${r.hora_label} | ${formatSoles(r.total)} | ${r.transacciones} |`);
    }
  }
  return lines;
}

function sectionCancellations(data: ToteatDashboardData): string[] {
  return [
    "### Cancelaciones",
    "",
    "| Métrica | Valor |",
    "| --- | --- |",
    `| Registros | ${data.cancellations.records} |`,
    `| Órdenes anuladas | ${data.cancellations.canceled_orders} |`,
    `| Líneas canceladas | ${data.cancellations.canceled_item_lines} |`,
    `| Monto ítems (estim.) | ${formatSoles(data.cancellations.canceled_item_estimated_amount)} |`,
    `| Pagos cancelados | ${formatSoles(data.cancellations.canceled_payments_amount)} |`,
  ];
}

const FOCUS_SECTIONS: Record<ToteatQueryFocus, Array<(d: ToteatDashboardData) => string[]>> = {
  auto: [
    sectionFinancial,
    sectionBusiness,
    sectionWaiters,
    sectionPayments,
    sectionProducts,
    sectionCharts,
    sectionCancellations,
  ],
  summary: [sectionFinancial, sectionBusiness],
  ticket: [sectionFinancial, sectionBusiness],
  waiters: [sectionWaiters, sectionFinancial],
  products: [sectionProducts, sectionFinancial],
  payments: [sectionPayments, sectionFinancial],
  business: [sectionBusiness, sectionFinancial],
  cancellations: [sectionCancellations, sectionFinancial],
  charts: [sectionCharts, sectionFinancial],
};

export function formatToteatForAI(
  data: ToteatDashboardData,
  params: ToteatQueryParams,
): string {
  const apiPath = buildToteatApiQueryString(params);
  const lines: string[] = [
    `### ${getToteatSalesReportLabel()} (Toteat)`,
    "",
    getToteatSourceDescription(),
    "",
    "### Parámetros API ejecutados",
    "",
    "Equivalente interno a la consulta del dashboard Toteat:",
    "",
    "```",
    apiPath,
    "```",
    "",
    "| Parámetro | Valor |",
    "| --- | --- |",
    `| reporte | ${getToteatSalesReportLabel()} |`,
    `| restaurant | ${data.restaurant.name} (${data.restaurant.id}) |`,
    `| start_date | ${params.startDate} |`,
    `| end_date | ${params.endDate} |`,
    `| hour_from | ${params.hourFrom ?? "— (todo el día)"} |`,
    `| hour_to | ${params.hourTo ?? "— (todo el día)"} |`,
    `| turno aplicado | ${formatHourRange(data.applied_filters.hour_from, data.applied_filters.hour_to)} |`,
    `| foco detectado | ${params.focus} |`,
    "",
    "**Endpoints:** API Toteat `/sales` + `/orders/cancellation-report`",
    "",
  ];

  const builders = FOCUS_SECTIONS[params.focus] ?? FOCUS_SECTIONS.auto;
  const seen = new Set<string>();
  for (const build of builders) {
    const section = build(data);
    const key = section[0];
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(...section, "");
  }

  if (params.focus !== "auto") {
    lines.push(
      "_Otros datos disponibles en la misma consulta: meseros, productos, medios de pago, gráficos por hora/turno, cancelaciones._",
      "",
    );
  }

  lines.push(
    "_Cruce interno: monto por línea (products[].payed). Responde usando las tablas anteriores, no solo venta bruta._",
  );

  return lines.join("\n");
}

export function formatToteatComparisonForAI(
  current: ToteatDashboardData,
  previous: ToteatDashboardData,
  params: ToteatQueryParams,
): string {
  const blocks = [
    formatToteatForAI(current, params),
    "",
    "---",
    "",
    `### Periodo comparativo (${previous.start_date} → ${previous.end_date})`,
    "",
    "| Métrica | Periodo actual | Periodo anterior | Variación |",
    "| --- | --- | --- | --- |",
    `| Venta bruta | ${formatSoles(current.total_sales)} | ${formatSoles(previous.total_sales)} | ${formatSoles(current.total_sales - previous.total_sales)} |`,
    `| Venta neta | ${formatSoles(current.total_net_sales)} | ${formatSoles(previous.total_net_sales)} | ${formatSoles(current.total_net_sales - previous.total_net_sales)} |`,
    `| Órdenes | ${current.orders_count} | ${previous.orders_count} | ${current.orders_count - previous.orders_count} |`,
    `| Ticket prom. bruto | ${formatSoles(current.average_ticket_gross)} | ${formatSoles(previous.average_ticket_gross)} | ${formatSoles(current.average_ticket_gross - previous.average_ticket_gross)} |`,
  ];
  return blocks.join("\n");
}
