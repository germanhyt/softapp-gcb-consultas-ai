import { formatSoles } from "@/lib/config/column-rules";
import { resolveVentasDateRangeYmd, VENTAS_PERIOD_LABELS } from "@/lib/scheduler/ventas-report-period";
import type { VentasReportPeriodPreset } from "@/lib/scheduler/types";
import { getToteatDashboardData, type ToteatDashboardData } from "./dashboard-data";
import {
  getToteatSalesReportLabel,
  getToteatSourceDescription,
  getToteatSourceNoteShort,
} from "./source-context";

export interface ToteatReportOptions {
  period?: VentasReportPeriodPreset;
  /** Si se indican ambas fechas, tienen prioridad sobre period. */
  startDate?: string;
  endDate?: string;
  restaurantId?: string | null;
  hourFrom?: number | null;
  hourTo?: number | null;
  referenceDate?: Date;
}

export interface ToteatReportResult {
  content: string;
  csv: string;
  csvFilename: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  data: ToteatDashboardData;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatHourRange(hourFrom: number | null, hourTo: number | null): string {
  if (hourFrom === null && hourTo === null) return "Todo el día";
  const from = hourFrom !== null ? `${String(hourFrom).padStart(2, "0")}:00` : "00:00";
  const to = hourTo !== null ? `${String(hourTo).padStart(2, "0")}:59` : "23:59";
  if (hourFrom !== null && hourTo !== null && hourFrom > hourTo) {
    return `${from} – ${to} (Lima, cruza día)`;
  }
  return `${from} – ${to} (Lima)`;
}

function buildChartsSection(data: ToteatDashboardData): string[] {
  const lines: string[] = [];
  if (
    data.charts.por_turno.length === 0 &&
    data.charts.por_dia.length === 0 &&
    data.charts.por_hora.length === 0
  ) {
    return lines;
  }

  lines.push("### Ventas por turno / día / hora", "");
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

function buildMarkdownReport(data: ToteatDashboardData, periodLabel: string): string {
  const hourRange = formatHourRange(
    data.applied_filters.hour_from,
    data.applied_filters.hour_to,
  );

  const lines: string[] = [
    `## ${getToteatSalesReportLabel()} — Toteat`,
    "",
    getToteatSourceDescription(),
    "",
    `**Restaurante API:** ${data.restaurant.name}`,
    `**Periodo:** ${data.start_date} → ${data.end_date} (${periodLabel})`,
    `**Turno aplicado:** ${hourRange}`,
    "",
    "### Resumen general",
    "",
    "| Métrica | Valor |",
    "| --- | --- |",
    `| Venta bruta | ${formatSoles(data.total_sales)} |`,
    `| Venta bruta - descuentos | ${formatSoles(data.total_sales_after_discounts)} |`,
    `| Impuestos | ${formatSoles(data.total_taxes)} |`,
    `| Venta neta | ${formatSoles(data.total_net_sales)} |`,
    `| Total pagado | ${formatSoles(data.total_paid)} |`,
    `| Descuentos | ${formatSoles(data.total_discounts)} |`,
    `| Propinas | ${formatSoles(data.total_gratuity)} |`,
    `| Pedidos | ${data.orders_count} |`,
    `| Pagos / cierres | ${data.payments_count} |`,
    `| Comensales | ${data.clients_count || "—"} |`,
    `| Ticket promedio (bruto) | ${formatSoles(data.average_ticket_gross)} |`,
    `| Ticket promedio (neto) | ${formatSoles(data.average_ticket_net)} |`,
    data.clients_count > 0
      ? `| Ticket promedio (comensal) | ${formatSoles(data.average_ticket_per_client)} |`
      : "",
    "",
    "### Cruce interno (Refugio / Sisa / Limanesas)",
    "",
    "| Negocio | Monto | % | Pedidos | Ticket prom. | Líneas |",
    "| --- | --- | --- | --- | --- | --- |",
  ].filter(Boolean);

  for (const b of data.business_split.by_business) {
    lines.push(
      `| ${b.business} | ${formatSoles(b.total)} | ${b.percentage}% | ${b.orders} | ${formatSoles(b.average_ticket)} | ${b.line_items} |`,
    );
  }
  lines.push(`| **Total** | **${formatSoles(data.business_split.total)}** | 100% | — | — | — |`);
  if (data.business_split.rules.length > 0) {
    lines.push("", "**Reglas de clasificación:**");
    for (const rule of data.business_split.rules) {
      lines.push(`- ${rule}`);
    }
  }

  if (data.top_waiters.length > 0) {
    lines.push("", "### Top meseros", "", "| Mesero | Ventas | Pedidos |", "| --- | --- | --- |");
    for (const w of data.top_waiters.slice(0, 5)) {
      lines.push(`| ${w.waiterName} | ${formatSoles(w.sales)} | ${w.orders} |`);
    }
  }

  if (data.payment_methods.length > 0) {
    lines.push("", "### Medios de pago", "", "| Medio | Monto | Transacciones |", "| --- | --- | --- |");
    for (const m of data.payment_methods.slice(0, 8)) {
      lines.push(`| ${m.name} | ${formatSoles(m.amount)} | ${m.count} |`);
    }
  }

  if (data.top_products.length > 0) {
    lines.push("", "### Top productos", "", "| Producto | Cantidad | Ingreso |", "| --- | --- | --- |");
    for (const p of data.top_products.slice(0, 10)) {
      lines.push(`| ${p.name} | ${p.quantity} | ${formatSoles(p.revenue)} |`);
    }
  }

  const chartLines = buildChartsSection(data);
  if (chartLines.length > 0) {
    lines.push("", ...chartLines);
  }

  lines.push(
    "",
    "### Cancelaciones",
    "",
    "| Métrica | Valor |",
    "| --- | --- |",
    `| Registros | ${data.cancellations.records} |`,
    `| Pedidos cancelados | ${data.cancellations.canceled_orders} |`,
    `| Líneas canceladas | ${data.cancellations.canceled_item_lines} |`,
    `| Monto estimado ítems | ${formatSoles(data.cancellations.canceled_item_estimated_amount)} |`,
    `| Pagos cancelados | ${formatSoles(data.cancellations.canceled_payments_amount)} |`,
  );

  if (data.fiscal_documents.available) {
    lines.push(
      "",
      "### Documentos fiscales",
      "",
      `Total: **${data.fiscal_documents.total}**`,
    );
  }

  lines.push(
    "",
    "_Montos del cruce interno usan products[].payed por línea (estimado operativo)._",
  );

  return lines.join("\n");
}

function buildCsvReport(data: ToteatDashboardData, periodLabel: string): string {
  const rows: string[] = [];
  const push = (...cols: (string | number)[]) => rows.push(cols.map(csvEscape).join(","));

  push("seccion", "campo", "valor");
  push("meta", "reporte_ventas", getToteatSalesReportLabel());
  push("meta", "fuente", getToteatSourceNoteShort());
  push("meta", "restaurante", data.restaurant.name);
  push("meta", "periodo", `${data.start_date}..${data.end_date}`);
  push("meta", "periodo_preset", periodLabel);
  push(
    "meta",
    "turno_aplicado",
    formatHourRange(data.applied_filters.hour_from, data.applied_filters.hour_to),
  );
  push("resumen", "total_sales", data.total_sales);
  push("resumen", "total_sales_after_discounts", data.total_sales_after_discounts);
  push("resumen", "total_taxes", data.total_taxes);
  push("resumen", "total_net_sales", data.total_net_sales);
  push("resumen", "total_paid", data.total_paid);
  push("resumen", "total_discounts", data.total_discounts);
  push("resumen", "total_gratuity", data.total_gratuity);
  push("resumen", "orders_count", data.orders_count);
  push("resumen", "payments_count", data.payments_count);
  push("resumen", "clients_count", data.clients_count);
  push("resumen", "average_ticket_gross", data.average_ticket_gross);
  push("resumen", "average_ticket_net", data.average_ticket_net);
  push("resumen", "average_ticket_per_client", data.average_ticket_per_client);

  push("");
  push("cruce_interno", "negocio", "total", "porcentaje", "pedidos", "ticket_promedio", "lineas");
  for (const b of data.business_split.by_business) {
    push("cruce_interno", b.business, b.total, b.percentage, b.orders, b.average_ticket, b.line_items);
  }

  push("");
  push("top_meseros", "mesero", "ventas", "pedidos");
  for (const w of data.top_waiters) {
    push("top_meseros", w.waiterName, w.sales, w.orders);
  }

  push("");
  push("medios_pago", "medio", "monto", "transacciones");
  for (const m of data.payment_methods) {
    push("medios_pago", m.name, m.amount, m.count);
  }

  push("");
  push("top_productos", "producto", "cantidad", "ingreso");
  for (const p of data.top_products) {
    push("top_productos", p.name, p.quantity, p.revenue);
  }

  push("");
  push("cancelaciones", "metrica", "valor");
  push("cancelaciones", "records", data.cancellations.records);
  push("cancelaciones", "canceled_orders", data.cancellations.canceled_orders);
  push("cancelaciones", "canceled_item_lines", data.cancellations.canceled_item_lines);
  push(
    "cancelaciones",
    "canceled_item_estimated_amount",
    data.cancellations.canceled_item_estimated_amount,
  );
  push("cancelaciones", "canceled_payments_amount", data.cancellations.canceled_payments_amount);

  if (data.charts.por_turno.length > 0) {
    push("");
    push("ventas_por_turno", "turno", "venta", "transacciones");
    for (const r of data.charts.por_turno) {
      push("ventas_por_turno", r.turno, r.total, r.transacciones);
    }
  }
  if (data.charts.por_dia.length > 0) {
    push("");
    push("ventas_por_dia", "dia", "venta", "transacciones");
    for (const r of data.charts.por_dia) {
      push("ventas_por_dia", r.dia_label, r.total, r.transacciones);
    }
  }

  return rows.join("\n");
}

export async function generateToteatScheduledReport(
  options: ToteatReportOptions,
): Promise<ToteatReportResult> {
  let start: string;
  let end: string;
  let periodLabel: string;

  if (options.startDate && options.endDate) {
    start = options.startDate;
    end = options.endDate;
    periodLabel = `${start} → ${end}`;
  } else {
    const period = options.period ?? "yesterday";
    const resolved = resolveVentasDateRangeYmd(period, options.referenceDate);
    start = resolved.start;
    end = resolved.end;
    periodLabel = VENTAS_PERIOD_LABELS[period] ?? resolved.label;
  }

  const data = await getToteatDashboardData({
    startDate: start,
    endDate: end,
    restaurantId: options.restaurantId,
    hourFrom: options.hourFrom ?? null,
    hourTo: options.hourTo ?? null,
  });

  const csvFilename = `toteat-${data.restaurant.id}-${start}_${end}.csv`;

  return {
    content: buildMarkdownReport(data, periodLabel),
    csv: buildCsvReport(data, periodLabel),
    csvFilename,
    periodLabel,
    startDate: start,
    endDate: end,
    data,
  };
}
