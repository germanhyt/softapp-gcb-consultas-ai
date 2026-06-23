import { resolveToteatRestaurant } from "@/lib/toteat/restaurants-config";
import type { ChartsData } from "@/components/dashboard/trend-charts";

const DIAS_LABEL: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

interface ToteatPaymentForm {
  name?: string;
  amount?: number;
}

interface ToteatProduct {
  name?: string;
  quantity?: number;
  payed?: number;
  hierarchyName?: string;
}

interface ToteatSaleRow {
  orderId?: number | string;
  dateClosed?: string;
  zoneName?: string;
  waiterName?: string;
  total?: number;
  payed?: number;
  discounts?: number;
  gratuity?: number;
  taxes?: number;
  subtotal?: number;
  numberClients?: number;
  paymentForms?: ToteatPaymentForm[];
  products?: ToteatProduct[];
}

interface ToteatCancellationRow {
  status?: string;
  comments?: string;
  closed_at?: string;
  payments?: Array<{ amount_paid?: number }>;
  cart?: Array<{ canceled?: boolean; quantity?: number; unit_price?: number }>;
}

export interface ToteatDashboardParams {
  startDate: string;
  endDate: string;
  restaurantId?: string | null;
  hourFrom?: number | null;
  hourTo?: number | null;
}

export interface ToteatDashboardData {
  restaurant: { id: string; name: string };
  start_date: string;
  end_date: string;
  applied_filters: { hour_from: number | null; hour_to: number | null; timezone: string };
  total_sales: number;
  total_sales_after_discounts: number;
  total_taxes: number;
  total_net_sales: number;
  total_paid: number;
  total_discounts: number;
  total_gratuity: number;
  orders_count: number;
  payments_count: number;
  clients_count: number;
  average_ticket_gross: number;
  average_ticket_net: number;
  average_ticket_per_client: number;
  charts: ChartsData;
  top_waiters: Array<{ waiterName: string; sales: number; orders: number }>;
  payment_methods: Array<{ name: string; amount: number; count: number }>;
  top_products: Array<{ name: string; quantity: number; revenue: number }>;
  business_split: {
    rules: string[];
    by_business: Array<{
      business: "Sisa" | "Limanesas" | "Refugio";
      total: number;
      percentage: number;
      line_items: number;
      orders: number;
      average_ticket: number;
    }>;
    total: number;
  };
  cancellations: {
    records: number;
    canceled_orders: number;
    canceled_item_lines: number;
    canceled_item_estimated_amount: number;
    canceled_payments_amount: number;
    by_status: Array<{ status: string; count: number }>;
    top_comments: Array<{ comment: string; count: number }>;
  };
  fiscal_documents: {
    available: boolean;
    total: number;
    by_type: Array<{ type: string; count: number }>;
    message: string;
  };
}

type InternalBusiness = "Sisa" | "Limanesas" | "Refugio";

function toYmdCompact(dateStr: string): string {
  return dateStr.replaceAll("-", "");
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeAverage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return roundMoney(numerator / denominator);
}

function normalizeText(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCafeteriaZone(zoneName?: string): boolean {
  return normalizeText(String(zoneName || "")).includes("cafeter");
}

function classifyByCategory(
  zoneName: string | undefined,
  hierarchyName: string | undefined,
  productName: string | undefined,
): InternalBusiness {
  if (isCafeteriaZone(zoneName)) return "Sisa";
  const text = normalizeText(`${hierarchyName || ""} ${productName || ""}`);
  if (text.includes("limanesa")) return "Limanesas";
  if (text.includes("sisa")) return "Sisa";
  return "Refugio";
}

function parseYmdAsUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function formatUtcDateAsYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function splitDateRange(startDate: string, endDate: string, maxDays: number) {
  const chunks: Array<{ ini: string; end: string }> = [];
  let cursor = parseYmdAsUtc(startDate);
  const end = parseYmdAsUtc(endDate);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor.getTime());
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + (maxDays - 1));
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({
      ini: toYmdCompact(formatUtcDateAsYmd(cursor)),
      end: toYmdCompact(formatUtcDateAsYmd(chunkEnd)),
    });
    cursor = new Date(chunkEnd.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

function formatYmdCompactToDashed(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function getClosedHour(isoDate?: string): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/Lima",
  }).formatToParts(d);
  const hourPart = parts.find((p) => p.type === "hour");
  if (!hourPart) return null;
  const hour = Number(hourPart.value);
  return Number.isFinite(hour) ? hour : null;
}

function matchesHourFilter(
  isoDate: string | undefined,
  hourFrom: number | null,
  hourTo: number | null,
): boolean {
  if (hourFrom === null && hourTo === null) return true;
  const hour = getClosedHour(isoDate);
  if (hour === null) return false;
  // Rango normal: 08 -> 18
  if (hourFrom !== null && hourTo !== null && hourFrom <= hourTo) {
    return hour >= hourFrom && hour <= hourTo;
  }
  // Rango cruzando día: 19 -> 06
  if (hourFrom !== null && hourTo !== null && hourFrom > hourTo) {
    return hour >= hourFrom || hour <= hourTo;
  }
  if (hourFrom !== null && hour < hourFrom) return false;
  if (hourTo !== null && hour > hourTo) return false;
  return true;
}

function findFullyCompensatedOrderIds(rows: ToteatSaleRow[]): Set<string> {
  const totalsByOrder = new Map<string, { total: number; paid: number }>();
  for (const row of rows) {
    if (row.orderId == null) continue;
    const orderId = String(row.orderId);
    const current = totalsByOrder.get(orderId) || { total: 0, paid: 0 };
    current.total += safeNum(row.total);
    current.paid += safeNum(row.payed);
    totalsByOrder.set(orderId, current);
  }

  const fullyCompensated = new Set<string>();
  for (const [orderId, totals] of totalsByOrder.entries()) {
    if (Math.abs(totals.total) < 0.000001 && Math.abs(totals.paid) < 0.000001) {
      fullyCompensated.add(orderId);
    }
  }
  return fullyCompensated;
}

export async function getToteatDashboardData(
  params: ToteatDashboardParams,
): Promise<ToteatDashboardData> {
  const { startDate, endDate, restaurantId, hourFrom = null, hourTo = null } = params;
  const cfg = resolveToteatRestaurant(restaurantId);
  if (!cfg) {
    throw new Error("No hay restaurantes Toteat configurados.");
  }

  const baseParams = new URLSearchParams({
    xir: cfg.xir,
    xil: cfg.xil,
    xiu: cfg.xiu,
    xapitoken: cfg.xapitoken,
  });
  const ranges = splitDateRange(startDate, endDate, 15);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const allRows: ToteatSaleRow[] = [];
    const cancellationRows: ToteatCancellationRow[] = [];

    for (const r of ranges) {
      const salesUrl = `${cfg.baseUrl}/sales?${baseParams.toString()}&ini=${r.ini}&end=${r.end}`;
      const cancellationUrl = `${cfg.baseUrl}/orders/cancellation-report?${baseParams.toString()}&start_date=${formatYmdCompactToDashed(r.ini)}&end_date=${formatYmdCompactToDashed(r.end)}`;

      const [salesRes, cancellationRes] = await Promise.all([
        fetch(salesUrl, { signal: controller.signal }),
        fetch(cancellationUrl, { signal: controller.signal }).catch(() => null),
      ]);

      if (!salesRes.ok) throw new Error(`Toteat sales error ${salesRes.status}`);
      const salesJson = (await salesRes.json()) as { ok?: boolean; msg?: unknown; data?: ToteatSaleRow[] };
      if (!salesJson.ok) throw new Error(`Toteat sales: ${String(salesJson.msg || "respuesta inválida")}`);
      if (Array.isArray(salesJson.data)) allRows.push(...salesJson.data);

      if (cancellationRes?.ok) {
        const cancellationJson = (await cancellationRes.json()) as {
          ok?: boolean;
          data?: ToteatCancellationRow[];
        };
        if (cancellationJson.ok && Array.isArray(cancellationJson.data)) {
          cancellationRows.push(...cancellationJson.data);
        }
      }
    }

    const hourFilteredRows = allRows.filter((r) => matchesHourFilter(r.dateClosed, hourFrom, hourTo));
    const fullyCompensatedOrderIds = findFullyCompensatedOrderIds(hourFilteredRows);
    const rows = hourFilteredRows.filter((row) => {
      if (row.orderId == null) return true;
      return !fullyCompensatedOrderIds.has(String(row.orderId));
    });
    const filteredCancellations = cancellationRows.filter((r) =>
      matchesHourFilter(r.closed_at, hourFrom, hourTo),
    );

    const orderIds = new Set<string>();
    const businessTotals: Record<InternalBusiness, number> = { Sisa: 0, Limanesas: 0, Refugio: 0 };
    const businessLines: Record<InternalBusiness, number> = { Sisa: 0, Limanesas: 0, Refugio: 0 };
    const businessOrders: Record<InternalBusiness, Set<string>> = {
      Sisa: new Set(),
      Limanesas: new Set(),
      Refugio: new Set(),
    };
    const totals = { totalSales: 0, totalPaid: 0, totalDiscounts: 0, totalGratuity: 0, totalTaxes: 0 };
    const byDay = new Map<number, { total: number; transacciones: number }>();
    const byHour = new Map<number, { total: number; transacciones: number }>();
    const byShift = new Map<string, { total: number; transacciones: number }>();
    const methodMap = new Map<string, { amount: number; count: number }>();
    const productMap = new Map<string, { quantity: number; revenue: number }>();
    const clientsByOrder = new Map<string, number>();

    for (const row of rows) {
      if (row.orderId != null) {
        const orderId = String(row.orderId);
        orderIds.add(orderId);
        const clients = safeNum(row.numberClients);
        if (clients > 0) {
          const prev = clientsByOrder.get(orderId) ?? 0;
          clientsByOrder.set(orderId, Math.max(prev, clients));
        }
      }
      totals.totalSales += safeNum(row.total);
      totals.totalPaid += safeNum(row.payed);
      totals.totalDiscounts += safeNum(row.discounts);
      totals.totalGratuity += safeNum(row.gratuity);
      totals.totalTaxes += safeNum(row.taxes);

      const closedAt = row.dateClosed ? new Date(row.dateClosed) : null;
      if (closedAt && !Number.isNaN(closedAt.valueOf())) {
        const day = closedAt.getUTCDay();
        const hour = getClosedHour(row.dateClosed) ?? closedAt.getUTCHours();
        const shift = hour >= 8 && hour <= 11 ? "Mañana" : hour >= 12 && hour <= 15 ? "Tarde" : "Noche";
        const rowTotal = safeNum(row.total);

        const dayBucket = byDay.get(day) || { total: 0, transacciones: 0 };
        dayBucket.total += rowTotal;
        dayBucket.transacciones += 1;
        byDay.set(day, dayBucket);

        const hourBucket = byHour.get(hour) || { total: 0, transacciones: 0 };
        hourBucket.total += rowTotal;
        hourBucket.transacciones += 1;
        byHour.set(hour, hourBucket);

        const shiftBucket = byShift.get(shift) || { total: 0, transacciones: 0 };
        shiftBucket.total += rowTotal;
        shiftBucket.transacciones += 1;
        byShift.set(shift, shiftBucket);
      }

      for (const pm of row.paymentForms || []) {
        const name = pm.name?.trim() || "Sin medio";
        const current = methodMap.get(name) || { amount: 0, count: 0 };
        current.amount += safeNum(pm.amount);
        current.count += 1;
        methodMap.set(name, current);
      }

      for (const p of row.products || []) {
        const name = p.name?.trim() || "Sin nombre";
        const current = productMap.get(name) || { quantity: 0, revenue: 0 };
        const quantity = safeNum(p.quantity);
        const payed = safeNum(p.payed);
        current.quantity += quantity;
        current.revenue += payed;
        productMap.set(name, current);

        const biz = classifyByCategory(row.zoneName, p.hierarchyName, p.name);
        businessTotals[biz] += payed;
        businessLines[biz] += quantity > 0 ? quantity : 1;
        if (row.orderId != null) businessOrders[biz].add(String(row.orderId));
      }

      if (!row.products || row.products.length === 0) {
        const fallbackBiz: InternalBusiness = isCafeteriaZone(row.zoneName) ? "Sisa" : "Refugio";
        businessTotals[fallbackBiz] += safeNum(row.total);
        businessLines[fallbackBiz] += 1;
        if (row.orderId != null) businessOrders[fallbackBiz].add(String(row.orderId));
      }
    }

    const waitersFromRows = new Map<string, { sales: number; orders: Set<string> }>();
    for (const row of rows) {
      const key = String(row.waiterName || "Sin mesero");
      const current = waitersFromRows.get(key) || { sales: 0, orders: new Set<string>() };
      current.sales += safeNum(row.total);
      if (row.orderId != null) current.orders.add(String(row.orderId));
      waitersFromRows.set(key, current);
    }

    const businessSplitTotal = businessTotals.Sisa + businessTotals.Limanesas + businessTotals.Refugio;

    let canceledOrderCount = 0;
    let canceledItemLines = 0;
    let canceledItemEstimatedAmount = 0;
    let canceledPaymentsAmount = 0;
    const cancellationByStatus = new Map<string, number>();
    const cancellationCommentMap = new Map<string, number>();

    for (const row of filteredCancellations) {
      const status = String(row.status || "UNKNOWN").trim().toUpperCase();
      cancellationByStatus.set(status, (cancellationByStatus.get(status) || 0) + 1);
      if (status === "CANCELED") canceledOrderCount += 1;
      for (const line of row.cart || []) {
        if (line.canceled) {
          canceledItemLines += 1;
          canceledItemEstimatedAmount += safeNum(line.quantity) * safeNum(line.unit_price);
        }
      }
      for (const payment of row.payments || []) {
        canceledPaymentsAmount += safeNum(payment.amount_paid);
      }
      const comment = String(row.comments || "").trim();
      if (comment) cancellationCommentMap.set(comment, (cancellationCommentMap.get(comment) || 0) + 1);
    }

    let fiscal_documents: ToteatDashboardData["fiscal_documents"] = {
      available: false,
      total: 0,
      by_type: [],
      message: "No disponible para este ambiente o credenciales.",
    };

    try {
      const fiscalRes = await fetch(
        `${cfg.baseUrl}/fiscaldocuments?${baseParams.toString()}&ini=${toYmdCompact(startDate)}&end=${toYmdCompact(endDate)}`,
        { signal: controller.signal },
      );
      if (fiscalRes.ok) {
        const fiscalJson = (await fiscalRes.json()) as unknown;
        if (Array.isArray(fiscalJson)) {
          const typeCounter = new Map<string, number>();
          for (const doc of fiscalJson) {
            const type = String(
              (doc as { type?: string; doc_type?: string }).type ||
                (doc as { type?: string; doc_type?: string }).doc_type ||
                "unknown",
            );
            typeCounter.set(type, (typeCounter.get(type) || 0) + 1);
          }
          fiscal_documents = {
            available: true,
            total: fiscalJson.length,
            by_type: Array.from(typeCounter.entries()).map(([type, count]) => ({ type, count })),
            message: "Documentos fiscales obtenidos correctamente.",
          };
        } else {
          fiscal_documents.message = String((fiscalJson as { msg?: unknown }).msg || "No autorizado.");
        }
      }
    } catch {
      // ignore
    }

    const totalSalesAfterDiscounts = totals.totalSales + totals.totalDiscounts;
    const totalNetSales = totalSalesAfterDiscounts - totals.totalTaxes;
    const ordersCount = orderIds.size;
    let clientsCount = 0;
    for (const orderId of orderIds) {
      clientsCount += clientsByOrder.get(orderId) ?? 0;
    }

    return {
      restaurant: { id: cfg.id, name: cfg.name },
      start_date: startDate,
      end_date: endDate,
      applied_filters: { hour_from: hourFrom, hour_to: hourTo, timezone: "America/Lima" },
      total_sales: roundMoney(totals.totalSales),
      total_sales_after_discounts: roundMoney(totalSalesAfterDiscounts),
      total_taxes: roundMoney(totals.totalTaxes),
      total_net_sales: roundMoney(totalNetSales),
      total_paid: roundMoney(totals.totalPaid),
      total_discounts: roundMoney(totals.totalDiscounts),
      total_gratuity: roundMoney(totals.totalGratuity),
      orders_count: ordersCount,
      payments_count: rows.length,
      clients_count: clientsCount,
      average_ticket_gross: safeAverage(totals.totalSales, ordersCount),
      average_ticket_net: safeAverage(totalNetSales, ordersCount),
      average_ticket_per_client: safeAverage(totals.totalSales, clientsCount),
      charts: {
        por_turno: Array.from(byShift.entries())
          .map(([turno, v]) => ({
            turno,
            total: Math.round(v.total * 100) / 100,
            transacciones: v.transacciones,
          }))
          .sort((a, b) => b.total - a.total),
        por_dia: Array.from(byDay.entries())
          .map(([dayNum, v]) => ({
            dia_num: dayNum === 0 ? 1 : dayNum + 1,
            dia_label: DIAS_LABEL[dayNum] || `Día ${dayNum}`,
            total: Math.round(v.total * 100) / 100,
            transacciones: v.transacciones,
          }))
          .sort((a, b) => a.dia_num - b.dia_num),
        por_hora: Array.from(byHour.entries())
          .map(([hora, v]) => ({
            hora,
            hora_label: `${String(hora).padStart(2, "0")}:00`,
            total: Math.round(v.total * 100) / 100,
            transacciones: v.transacciones,
          }))
          .sort((a, b) => a.hora - b.hora),
      },
      top_waiters: Array.from(waitersFromRows.entries())
        .map(([waiterName, values]) => ({
          waiterName,
          sales: Math.round(values.sales * 100) / 100,
          orders: values.orders.size,
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10),
      payment_methods: Array.from(methodMap.entries())
        .map(([name, v]) => ({
          name,
          amount: Math.round(v.amount * 100) / 100,
          count: v.count,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 12),
      top_products: Array.from(productMap.entries())
        .map(([name, v]) => ({
          name,
          quantity: Math.round(v.quantity * 100) / 100,
          revenue: Math.round(v.revenue * 100) / 100,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 12),
      business_split: {
        rules: [
          "zone/sector Cafeteria => Sisa",
          "fuera de Cafeteria: categoría o producto con 'Limanesa' => Limanesas",
          "fuera de Cafeteria: categoría o producto con 'Sisa' => Sisa",
          "resto => Refugio",
          "monto asignado por línea usando products[].payed (estimado operativo)",
        ],
        by_business: (["Sisa", "Limanesas", "Refugio"] as InternalBusiness[]).map((business) => ({
          business,
          total: Math.round(businessTotals[business] * 100) / 100,
          percentage:
            businessSplitTotal > 0
              ? Math.round((businessTotals[business] / businessSplitTotal) * 10000) / 100
              : 0,
          line_items: businessLines[business],
          orders: businessOrders[business].size,
          average_ticket: safeAverage(businessTotals[business], businessOrders[business].size),
        })),
        total: Math.round(businessSplitTotal * 100) / 100,
      },
      cancellations: {
        records: filteredCancellations.length,
        canceled_orders: canceledOrderCount,
        canceled_item_lines: canceledItemLines,
        canceled_item_estimated_amount: Math.round(canceledItemEstimatedAmount * 100) / 100,
        canceled_payments_amount: Math.round(canceledPaymentsAmount * 100) / 100,
        by_status: Array.from(cancellationByStatus.entries()).map(([status, count]) => ({ status, count })),
        top_comments: Array.from(cancellationCommentMap.entries())
          .map(([comment, count]) => ({ comment, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      },
      fiscal_documents,
    };
  } finally {
    clearTimeout(timeout);
  }
}
