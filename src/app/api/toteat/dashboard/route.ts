import { NextRequest, NextResponse } from "next/server";
import { resolveToteatRestaurant } from "@/lib/toteat/restaurants-config";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
  id?: number;
  amount?: number;
}

interface ToteatProduct {
  name?: string;
  quantity?: number;
  payed?: number;
}

interface ToteatSaleRow {
  orderId?: number | string;
  dateClosed?: string;
  total?: number;
  payed?: number;
  discounts?: number;
  gratuity?: number;
  paymentForms?: ToteatPaymentForm[];
  products?: ToteatProduct[];
}

interface ToteatSalesByWaiterRow {
  waiterName?: string;
  sales?: number;
  orders?: number;
}

interface ToteatCancellationPayment {
  amount_paid?: number;
}

interface ToteatCancellationCartLine {
  canceled?: boolean;
  quantity?: number;
  unit_price?: number;
}

interface ToteatCancellationRow {
  status?: string;
  comments?: string;
  payments?: ToteatCancellationPayment[];
  cart?: ToteatCancellationCartLine[];
}

function toYmdCompact(dateStr: string): string {
  return dateStr.replaceAll("-", "");
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }
    chunks.push({
      ini: toYmdCompact(formatUtcDateAsYmd(cursor)),
      end: toYmdCompact(formatUtcDateAsYmd(chunkEnd)),
    });
    cursor = new Date(chunkEnd.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const curYear = new Date().getFullYear();
  const startDate = sp.get("start_date") || `${curYear}-01-01`;
  const endDate = sp.get("end_date") || `${curYear}-12-31`;
  const restaurantId = sp.get("restaurant");

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const cfg = resolveToteatRestaurant(restaurantId);
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "No hay restaurantes Toteat configurados. Define TOTEAT_RESTAURANTS_JSON o TOTEAT_XIR/TOTEAT_XIL/TOTEAT_XIU/TOTEAT_XAPITOKEN.",
      },
      { status: 500 },
    );
  }

  const baseParams = new URLSearchParams({
    xir: cfg.xir,
    xil: cfg.xil,
    xiu: cfg.xiu,
    xapitoken: cfg.xapitoken,
  });
  const ranges = splitDateRange(startDate, endDate, 15);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const rows: ToteatSaleRow[] = [];
      const waitersAccumulator = new Map<string, { sales: number; orders: number }>();
      const cancellationRows: ToteatCancellationRow[] = [];

    for (const r of ranges) {
      const salesUrl = `${cfg.baseUrl}/sales?${baseParams.toString()}&ini=${r.ini}&end=${r.end}`;
      const salesByWaiterUrl = `${cfg.baseUrl}/salesbywaiter?${baseParams.toString()}&initial_date=${r.ini}&final_date=${r.end}`;
      const cancellationUrl = `${cfg.baseUrl}/orders/cancellation-report?${baseParams.toString()}&start_date=${formatYmdCompactToDashed(r.ini)}&end_date=${formatYmdCompactToDashed(r.end)}`;

      const [salesRes, waitersRes, cancellationRes] = await Promise.all([
        fetch(salesUrl, { signal: controller.signal }),
        fetch(salesByWaiterUrl, { signal: controller.signal }).catch(() => null),
        fetch(cancellationUrl, { signal: controller.signal }).catch(() => null),
      ]);

      if (!salesRes.ok) {
        throw new Error(`Toteat sales error ${salesRes.status}`);
      }

      const salesJson = (await salesRes.json()) as {
        ok?: boolean;
        msg?: unknown;
        data?: ToteatSaleRow[];
      };
      if (!salesJson.ok) {
        throw new Error(`Toteat sales: ${String(salesJson.msg || "respuesta inválida")}`);
      }
      if (Array.isArray(salesJson.data)) {
        rows.push(...salesJson.data);
      }

      if (waitersRes?.ok) {
        const waitersJson = (await waitersRes.json()) as { ok?: boolean; data?: ToteatSalesByWaiterRow[] };
        if (waitersJson.ok && Array.isArray(waitersJson.data)) {
          for (const waiter of waitersJson.data) {
            const key = String(waiter.waiterName || "Sin mesero");
            const current = waitersAccumulator.get(key) || { sales: 0, orders: 0 };
            current.sales += safeNum(waiter.sales);
            current.orders += safeNum(waiter.orders);
            waitersAccumulator.set(key, current);
          }
        }
      }

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

    const orderIds = new Set<string>();
    const totals = {
      totalSales: 0,
      totalPaid: 0,
      totalDiscounts: 0,
      totalGratuity: 0,
    };

    const byDay = new Map<number, { total: number; transacciones: number }>();
    const byHour = new Map<number, { total: number; transacciones: number }>();
    const byShift = new Map<string, { total: number; transacciones: number }>();

    const methodMap = new Map<string, { amount: number; count: number }>();
    const productMap = new Map<string, { quantity: number; revenue: number }>();

    for (const row of rows) {
      if (row.orderId != null) orderIds.add(String(row.orderId));
      totals.totalSales += safeNum(row.total);
      totals.totalPaid += safeNum(row.payed);
      totals.totalDiscounts += safeNum(row.discounts);
      totals.totalGratuity += safeNum(row.gratuity);

      const closedAt = row.dateClosed ? new Date(row.dateClosed) : null;
      if (closedAt && !Number.isNaN(closedAt.valueOf())) {
        const day = closedAt.getDay();
        const hour = closedAt.getHours();
        const shift = hour < 11 ? "Desayuno" : hour < 16 ? "Almuerzo" : hour < 20 ? "Tarde" : "Cena";

        const dayBucket = byDay.get(day) || { total: 0, transacciones: 0 };
        dayBucket.total += safeNum(row.total);
        dayBucket.transacciones += 1;
        byDay.set(day, dayBucket);

        const hourBucket = byHour.get(hour) || { total: 0, transacciones: 0 };
        hourBucket.total += safeNum(row.total);
        hourBucket.transacciones += 1;
        byHour.set(hour, hourBucket);

        const shiftBucket = byShift.get(shift) || { total: 0, transacciones: 0 };
        shiftBucket.total += safeNum(row.total);
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
        current.quantity += safeNum(p.quantity);
        current.revenue += safeNum(p.payed);
        productMap.set(name, current);
      }
    }

    const por_turno = Array.from(byShift.entries())
      .map(([turno, v]) => ({
        turno,
        total: Math.round(v.total * 100) / 100,
        transacciones: v.transacciones,
      }))
      .sort((a, b) => b.total - a.total);

    const por_dia = Array.from(byDay.entries())
      .map(([dayNum, v]) => ({
        dia_num: dayNum === 0 ? 1 : dayNum + 1,
        dia_label: DIAS_LABEL[dayNum] || `Día ${dayNum}`,
        total: Math.round(v.total * 100) / 100,
        transacciones: v.transacciones,
      }))
      .sort((a, b) => a.dia_num - b.dia_num);

    const por_hora = Array.from(byHour.entries())
      .map(([hora, v]) => ({
        hora,
        hora_label: `${String(hora).padStart(2, "0")}:00`,
        total: Math.round(v.total * 100) / 100,
        transacciones: v.transacciones,
      }))
      .sort((a, b) => a.hora - b.hora);

    const top_waiters = Array.from(waitersAccumulator.entries())
      .map(([waiterName, values]) => ({
        waiterName,
        sales: Math.round(values.sales * 100) / 100,
        orders: Math.round(values.orders * 100) / 100,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    const payment_methods = Array.from(methodMap.entries())
      .map(([name, v]) => ({
        name,
        amount: Math.round(v.amount * 100) / 100,
        count: v.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);

    const top_products = Array.from(productMap.entries())
      .map(([name, v]) => ({
        name,
        quantity: Math.round(v.quantity * 100) / 100,
        revenue: Math.round(v.revenue * 100) / 100,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 12);

    const cancellationByStatus = new Map<string, number>();
    let canceledOrderCount = 0;
    let canceledItemLines = 0;
    let canceledItemEstimatedAmount = 0;
    let canceledPaymentsAmount = 0;
    const cancellationCommentMap = new Map<string, number>();

    for (const row of cancellationRows) {
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
      if (comment) {
        cancellationCommentMap.set(comment, (cancellationCommentMap.get(comment) || 0) + 1);
      }
    }

    const cancellation_status_breakdown = Array.from(cancellationByStatus.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    const top_cancellation_comments = Array.from(cancellationCommentMap.entries())
      .map(([comment, count]) => ({ comment, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const fiscalDocumentsUrl = `${cfg.baseUrl}/fiscaldocuments?${baseParams.toString()}&ini=${toYmdCompact(startDate)}&end=${toYmdCompact(endDate)}`;
    let fiscal_documents = {
      available: false,
      total: 0,
      by_type: [] as Array<{ type: string; count: number }>,
      message: "No disponible para este ambiente o credenciales.",
    };

    try {
      const fiscalRes = await fetch(fiscalDocumentsUrl, { signal: controller.signal });
      if (fiscalRes.ok) {
        const fiscalJson = (await fiscalRes.json()) as unknown;
        if (Array.isArray(fiscalJson)) {
          const typeCounter = new Map<string, number>();
          for (const doc of fiscalJson) {
            const type = String((doc as { type?: string; doc_type?: string }).type || (doc as { type?: string; doc_type?: string }).doc_type || "unknown");
            typeCounter.set(type, (typeCounter.get(type) || 0) + 1);
          }
          fiscal_documents = {
            available: true,
            total: fiscalJson.length,
            by_type: Array.from(typeCounter.entries()).map(([type, count]) => ({ type, count })),
            message: "Documentos fiscales obtenidos correctamente.",
          };
        } else {
          const asObj = fiscalJson as { ok?: boolean; msg?: unknown };
          fiscal_documents.message = String(asObj.msg || "No autorizado o sin documentos.");
        }
      }
    } catch {
      // keep unavailable fallback
    }

      return NextResponse.json({
        restaurant: { id: cfg.id, name: cfg.name },
        start_date: startDate,
        end_date: endDate,
        total_sales: Math.round(totals.totalSales * 100) / 100,
        total_paid: Math.round(totals.totalPaid * 100) / 100,
        total_discounts: Math.round(totals.totalDiscounts * 100) / 100,
        total_gratuity: Math.round(totals.totalGratuity * 100) / 100,
        orders_count: orderIds.size,
        payments_count: rows.length,
        charts: { por_turno, por_dia, por_hora },
        top_waiters,
        payment_methods,
        top_products,
        cancellations: {
          records: cancellationRows.length,
          canceled_orders: canceledOrderCount,
          canceled_item_lines: canceledItemLines,
          canceled_item_estimated_amount: Math.round(canceledItemEstimatedAmount * 100) / 100,
          canceled_payments_amount: Math.round(canceledPaymentsAmount * 100) / 100,
          by_status: cancellation_status_breakdown,
          top_comments: top_cancellation_comments,
        },
        fiscal_documents,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.error("[toteat/dashboard] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function formatYmdCompactToDashed(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}
