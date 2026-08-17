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
  htmlContent: string;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlMetricCard(label: string, value: string): string {
  return `
    <div style="flex:1;min-width:180px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:700;">${escapeHtml(label)}</div>
      <div style="font-size:22px;color:#0f172a;font-weight:800;margin-top:6px;">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildHtmlTable(headers: string[], rows: string[][]): string {
  const thead = headers
    .map(
      (h) =>
        `<th style="text-align:left;padding:8px 10px;border:1px solid #e2e8f0;background:#ecfdf5;color:#065f46;font-size:12px;">${escapeHtml(h)}</th>`,
    )
    .join("");
  const tbody = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      const cells = r
        .map(
          (c) =>
            `<td style="padding:7px 10px;border:1px solid #e2e8f0;background:${bg};font-size:12px;color:#0f172a;">${escapeHtml(c)}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 14px;">`
    + `<thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

function buildHtmlReport(data: ToteatDashboardData, periodLabel: string): string {
  const hourRange = formatHourRange(data.applied_filters.hour_from, data.applied_filters.hour_to);
  const businessRows = data.business_split.by_business.map((b) => [
    b.business,
    formatSoles(b.total),
    `${b.percentage.toFixed(1)}%`,
    String(b.orders),
    formatSoles(b.average_ticket),
    String(b.line_items),
  ]);
  const waiterRows = data.top_waiters.slice(0, 6).map((w) => [
    w.waiterName,
    formatSoles(w.sales),
    String(w.orders),
  ]);
  const paymentRows = data.payment_methods.slice(0, 8).map((m) => [
    m.name,
    formatSoles(m.amount),
    String(m.count),
  ]);
  const productRows = data.top_products.slice(0, 8).map((p) => [
    p.name,
    String(p.quantity),
    formatSoles(p.revenue),
  ]);
  const rulesHtml =
    data.business_split.rules.length > 0
      ? `<h3 style="margin:16px 0 8px;color:#065f46;font-size:15px;">Reglas y observaciones</h3>
         <ul style="margin:8px 0 14px 18px;padding:0;color:#334155;font-size:12px;line-height:1.5;">
           ${data.business_split.rules.map((r) => `<li style="margin:3px 0;">${escapeHtml(r)}</li>`).join("")}
         </ul>`
      : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <h2 style="margin:0 0 8px;color:#065f46;font-size:20px;">${escapeHtml(getToteatSalesReportLabel())} — Toteat</h2>
      <p style="margin:0 0 6px;font-size:12px;color:#475569;">${escapeHtml(getToteatSourceDescription())}</p>
      <p style="margin:0 0 18px;font-size:12px;color:#475569;">
        <strong>Restaurante API:</strong> ${escapeHtml(data.restaurant.name)} &nbsp;·&nbsp;
        <strong>Periodo:</strong> ${escapeHtml(`${data.start_date} → ${data.end_date} (${periodLabel})`)} &nbsp;·&nbsp;
        <strong>Turno:</strong> ${escapeHtml(hourRange)}
      </p>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        ${buildHtmlMetricCard("Venta Bruta", formatSoles(data.total_sales))}
        ${buildHtmlMetricCard("Venta Neta", formatSoles(data.total_net_sales))}
        ${buildHtmlMetricCard("Pagado", formatSoles(data.total_paid))}
        ${buildHtmlMetricCard("Órdenes", String(data.orders_count))}
      </div>

      <h3 style="margin:16px 0 8px;color:#065f46;font-size:15px;">Cruce interno (Refugio / Sisa / Limanesas)</h3>
      ${buildHtmlTable(
        ["Negocio", "Monto", "%", "Pedidos", "Ticket prom.", "Líneas"],
        [...businessRows, ["TOTAL", formatSoles(data.business_split.total), "100%", "-", "-", "-"]],
      )}

      <h3 style="margin:16px 0 8px;color:#065f46;font-size:15px;">Resumen financiero</h3>
      ${buildHtmlTable(
        ["Métrica", "Valor"],
        [
          ["Venta bruta - descuentos", formatSoles(data.total_sales_after_discounts)],
          ["Impuestos", formatSoles(data.total_taxes)],
          ["Descuentos", formatSoles(data.total_discounts)],
          ["Propinas", formatSoles(data.total_gratuity)],
          ["Pagos / cierres", String(data.payments_count)],
          ["Comensales", String(data.clients_count || 0)],
          ["Ticket promedio (bruto)", formatSoles(data.average_ticket_gross)],
          ["Ticket promedio (neto)", formatSoles(data.average_ticket_net)],
          ["Ticket promedio (comensal)", formatSoles(data.average_ticket_per_client)],
        ],
      )}

      ${waiterRows.length > 0 ? `<h3 style="margin:16px 0 8px;color:#065f46;font-size:15px;">Top meseros</h3>${buildHtmlTable(["Mesero", "Ventas", "Pedidos"], waiterRows)}` : ""}
      ${paymentRows.length > 0 ? `<h3 style="margin:16px 0 8px;color:#065f46;font-size:15px;">Medios de pago</h3>${buildHtmlTable(["Medio", "Monto", "Transacciones"], paymentRows)}` : ""}
      ${productRows.length > 0 ? `<h3 style="margin:16px 0 8px;color:#065f46;font-size:15px;">Top productos</h3>${buildHtmlTable(["Producto", "Cantidad", "Ingreso"], productRows)}` : ""}
      ${rulesHtml}

      <p style="margin-top:14px;font-size:11px;color:#64748b;">
        Montos del cruce interno usan <code>products[].payed</code> por línea (estimado operativo).
      </p>
    </div>
  `;
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
    htmlContent: buildHtmlReport(data, periodLabel),
    csv: buildCsvReport(data, periodLabel),
    csvFilename,
    periodLabel,
    startDate: start,
    endDate: end,
    data,
  };
}
