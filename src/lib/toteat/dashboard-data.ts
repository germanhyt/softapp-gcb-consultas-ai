import { resolveToteatRestaurant, type ToteatRestaurantConfig } from "@/lib/toteat/restaurants-config";
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
  hierarchyId?: string | number;
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
  __forcedBusiness?: "Sisa" | "Limanesas" | "Refugio";
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
  apiMode?: "all" | "bar" | "limanesas" | "sisa";
  businessScope?: "all" | "refugio" | "sisa" | "limanesas";
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

function isSisaBarCategory(hierarchyName?: string, productName?: string): boolean {
  const hierarchy = normalizeText(hierarchyName || "");
  const product = normalizeText(productName || "");
  return hierarchy.includes("sisa bar") || product.includes("sisa bar");
}

/** Fuera de zona Cafetería: categorías explícitas Sisa (detalle ventas, no jerarquía). */
function isSisaOutsideCafeteria(hierarchyName?: string, productName?: string): boolean {
  if (isSisaBarCategory(hierarchyName, productName)) return false;

  const hierarchy = normalizeText(hierarchyName || "");
  const product = normalizeText(productName || "");

  if (hierarchy.includes("aperitivo cafeteria sisa") || product.includes("aperitivo cafeteria sisa")) {
    return true;
  }
  if (hierarchy === "sisa") return true;

  return false;
}

/** Cruce interno alineado al detalle de ventas Toteat (zona + categoría), no ventas por jerarquía. */
function classifyByCategory(
  zoneName: string | undefined,
  hierarchyName: string | undefined,
  productName: string | undefined,
): InternalBusiness {
  if (isCafeteriaZone(zoneName)) return "Sisa";
  const text = normalizeText(`${hierarchyName || ""} ${productName || ""}`);
  if (text.includes("limanesa")) return "Limanesas";
  if (isSisaOutsideCafeteria(hierarchyName, productName)) return "Sisa";
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

const MESES_CORTO = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Fecha calendario YYYY-MM-DD en America/Lima. */
function getClosedYmdLima(isoDate?: string): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

/** Lunes de la semana (ISO) para una fecha YYYY-MM-DD. */
function mondayOfWeek(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.valueOf())) return ymd;
  // getUTCDay: 0=Dom … 6=Sáb → desplazar a lunes
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatTendenciaDiaLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.valueOf())) return iso;
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatTendenciaSemanaLabel(inicioIso: string): string {
  const start = new Date(`${inicioIso}T12:00:00Z`);
  if (Number.isNaN(start.valueOf())) return inicioIso;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) =>
    `${String(dt.getUTCDate()).padStart(2, "0")} ${MESES_CORTO[dt.getUTCMonth()]}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatTendenciaMesLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MESES_CORTO[m - 1] ?? m} ${y}`;
}

function bumpPeriodBucket(
  map: Map<string, { total: number; transacciones: number }>,
  key: string,
  amount: number,
) {
  const bucket = map.get(key) || { total: 0, transacciones: 0 };
  bucket.total += amount;
  bucket.transacciones += 1;
  map.set(key, bucket);
}

function mapTendenciaSeries(
  map: Map<string, { total: number; transacciones: number }>,
  labelFn: (periodo: string) => string,
) {
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, v]) => ({
      periodo,
      label: labelFn(periodo),
      total: Math.round(v.total * 100) / 100,
      transacciones: v.transacciones,
    }));
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

function tagRowsForSource(
  rows: ToteatSaleRow[],
  sourcePrefix: string,
  forcedBusiness: "Sisa" | "Limanesas" | "Refugio",
): ToteatSaleRow[] {
  return rows.map((row) => ({
    ...row,
    orderId: row.orderId != null ? `${sourcePrefix}:${String(row.orderId)}` : row.orderId,
    __forcedBusiness: forcedBusiness,
  }));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.max(0, Math.round(asSeconds * 1000));
  const asDate = Date.parse(raw);
  if (Number.isNaN(asDate)) return null;
  return Math.max(0, asDate - Date.now());
}

function compactToUtcDate(ymdCompact: string): Date {
  const y = Number(ymdCompact.slice(0, 4));
  const m = Number(ymdCompact.slice(4, 6));
  const d = Number(ymdCompact.slice(6, 8));
  return new Date(Date.UTC(y, Math.max(0, m - 1), d));
}

function utcDateToCompact(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function splitCompactRangeInHalf(ini: string, end: string): Array<{ ini: string; end: string }> {
  if (ini >= end) return [{ ini, end }];
  const iniDate = compactToUtcDate(ini);
  const endDate = compactToUtcDate(end);
  const totalDays = Math.floor((endDate.getTime() - iniDate.getTime()) / 86_400_000) + 1;
  if (totalDays <= 1) return [{ ini, end }];
  const leftDays = Math.floor(totalDays / 2);
  const leftEndDate = new Date(iniDate.getTime());
  leftEndDate.setUTCDate(leftEndDate.getUTCDate() + leftDays - 1);
  const rightStartDate = new Date(leftEndDate.getTime());
  rightStartDate.setUTCDate(rightStartDate.getUTCDate() + 1);
  return [
    { ini, end: utcDateToCompact(leftEndDate) },
    { ini: utcDateToCompact(rightStartDate), end },
  ];
}

async function fetchSalesChunkWithRetry(
  cfg: ToteatRestaurantConfig,
  baseParams: URLSearchParams,
  ini: string,
  end: string,
  depth = 0,
  options?: {
    maxAttempts?: number;
    baseBackoffMs?: number;
    maxBackoffMs?: number;
  },
): Promise<ToteatSaleRow[]> {
  const salesUrl = `${cfg.baseUrl}/sales?${baseParams.toString()}&ini=${ini}&end=${end}`;
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseBackoffMs = options?.baseBackoffMs ?? 1200;
  const maxBackoffMs = options?.maxBackoffMs ?? 20000;
  let last429 = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const chunkController = new AbortController();
    const chunkTimeout = setTimeout(() => chunkController.abort(), cfg.timeoutMs);

    let salesRes: Response;
    try {
      salesRes = await fetch(salesUrl, { signal: chunkController.signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `Timeout al consultar API Toteat (${cfg.timeoutMs}ms por bloque de ${ini}-${end}). Reduce el rango o aumenta TOTEAT_TIMEOUT_MS.`,
        );
      }
      throw err;
    } finally {
      clearTimeout(chunkTimeout);
    }

    if (salesRes.status === 429) {
      last429 = true;
      if (attempt < maxAttempts) {
        const retryAfterMs = parseRetryAfterMs(salesRes);
        const backoffMs = retryAfterMs ?? baseBackoffMs * attempt;
        await wait(Math.min(Math.max(backoffMs, 300), maxBackoffMs));
        continue;
      }
      break;
    }
    if (salesRes.status >= 500 && attempt < maxAttempts) {
      await wait(600 * attempt);
      continue;
    }
    if (!salesRes.ok) throw new Error(`Toteat sales error ${salesRes.status}`);

    const salesJson = (await salesRes.json()) as { ok?: boolean; msg?: unknown; data?: ToteatSaleRow[] };
    if (!salesJson.ok) throw new Error(`Toteat sales: ${String(salesJson.msg || "respuesta inválida")}`);
    return Array.isArray(salesJson.data) ? salesJson.data : [];
  }

  if (last429 && ini < end && depth < 8) {
    const subRanges = splitCompactRangeInHalf(ini, end);
    if (subRanges.length > 1) {
      const rows: ToteatSaleRow[] = [];
      for (const sub of subRanges) {
        await wait(220);
        const subRows = await fetchSalesChunkWithRetry(cfg, baseParams, sub.ini, sub.end, depth + 1, options);
        rows.push(...subRows);
      }
      return rows;
    }
  }

  if (last429) {
    throw new Error(
      `Toteat sales error 429 (rate limit en ${ini}-${end}). Reduce el rango o reintenta en unos minutos.`,
    );
  }
  throw new Error(`Toteat sales error en ${ini}-${end}`);
}

async function fetchSalesRowsForRestaurant(
  cfg: ToteatRestaurantConfig,
  startDate: string,
  endDate: string,
  options?: {
    maxAttempts?: number;
    baseBackoffMs?: number;
    maxBackoffMs?: number;
  },
): Promise<ToteatSaleRow[]> {
  const baseParams = new URLSearchParams({
    xir: cfg.xir,
    xil: cfg.xil,
    xiu: cfg.xiu,
    xapitoken: cfg.xapitoken,
  });
  const ranges = splitDateRange(startDate, endDate, 15);
  const rows: ToteatSaleRow[] = [];

  for (const r of ranges) {
    const chunkRows = await fetchSalesChunkWithRetry(cfg, baseParams, r.ini, r.end, 0, options);
    rows.push(...chunkRows);
  }

  return rows;
}

export async function getToteatDashboardData(
  params: ToteatDashboardParams,
): Promise<ToteatDashboardData> {
  const {
    startDate,
    endDate,
    restaurantId,
    hourFrom = null,
    hourTo = null,
    apiMode = "all",
    businessScope = "all",
  } = params;
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
  const limanesasSourceRestaurantId = (process.env.TOTEAT_LIMANESAS_SOURCE_RESTAURANT_ID || "").trim();
  const limanesasAggregateForRestaurantId = (
    process.env.TOTEAT_LIMANESAS_AGGREGATE_FOR_RESTAURANT_ID || ""
  ).trim();
  const sisaSourceRestaurantId = (process.env.TOTEAT_SISA_SOURCE_RESTAURANT_ID || "").trim();
  const sisaAggregateForRestaurantId = (process.env.TOTEAT_SISA_AGGREGATE_FOR_RESTAURANT_ID || "").trim();
  const shouldAggregateExternalLimanesas =
    apiMode === "all" &&
    Boolean(limanesasSourceRestaurantId) &&
    limanesasSourceRestaurantId !== cfg.id &&
    (!limanesasAggregateForRestaurantId || limanesasAggregateForRestaurantId === cfg.id);
  const shouldAggregateExternalSisa =
    apiMode === "all" &&
    Boolean(sisaSourceRestaurantId) &&
    sisaSourceRestaurantId !== cfg.id &&
    (!sisaAggregateForRestaurantId || sisaAggregateForRestaurantId === cfg.id);
  const shouldFetchCancellations = apiMode !== "limanesas" && apiMode !== "sisa";
  const forcedBusinessByApi: InternalBusiness | null =
    apiMode === "limanesas" ? "Limanesas" : apiMode === "sisa" ? "Sisa" : null;
  const primarySalesRetryOptions =
    apiMode === "limanesas" || apiMode === "sisa"
      ? {
          maxAttempts: 6,
          baseBackoffMs: 2000,
          maxBackoffMs: 45000,
        }
      : undefined;
  const externalSalesRetryOptions = {
    maxAttempts: 6,
    baseBackoffMs: 2000,
    maxBackoffMs: 45000,
  };

  try {
    const allRows: ToteatSaleRow[] = [];
    const cancellationRows: ToteatCancellationRow[] = [];
    let externalLimanesasRows: ToteatSaleRow[] = [];
    let externalLimanesasName = "";
    let externalLimanesasError = "";
    let externalSisaRows: ToteatSaleRow[] = [];
    let externalSisaName = "";
    let externalSisaError = "";

    for (const r of ranges) {
      const cancellationUrl = `${cfg.baseUrl}/orders/cancellation-report?${baseParams.toString()}&start_date=${formatYmdCompactToDashed(r.ini)}&end_date=${formatYmdCompactToDashed(r.end)}`;
      let cancellationRes: Response | null;
      try {
        const salesRows = await fetchSalesChunkWithRetry(
          cfg,
          baseParams,
          r.ini,
          r.end,
          0,
          primarySalesRetryOptions,
        );
        const cancellationResponse = shouldFetchCancellations
          ? await (async () => {
              const cancellationController = new AbortController();
              const cancellationTimeout = setTimeout(() => cancellationController.abort(), cfg.timeoutMs);
              try {
                return await fetch(cancellationUrl, {
                  signal: cancellationController.signal,
                }).catch(() => null);
              } finally {
                clearTimeout(cancellationTimeout);
              }
            })()
          : null;
        allRows.push(...salesRows);
        cancellationRes = cancellationResponse;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            `Timeout al consultar API Toteat (${cfg.timeoutMs}ms por bloque de ${r.ini}-${r.end}). Reduce el rango o aumenta TOTEAT_TIMEOUT_MS.`,
          );
        }
        throw err;
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

    if (shouldAggregateExternalLimanesas) {
      const limanesasCfg = resolveToteatRestaurant(limanesasSourceRestaurantId);
      if (limanesasCfg) {
        try {
          externalLimanesasRows = await fetchSalesRowsForRestaurant(
            limanesasCfg,
            startDate,
            endDate,
            externalSalesRetryOptions,
          );
          externalLimanesasName = limanesasCfg.name;
        } catch (err) {
          externalLimanesasError = err instanceof Error ? err.message : String(err);
          console.error(
            `[toteat/dashboard] No se pudo sumar API Limanesas (${limanesasCfg.id}):`,
            err,
          );
        }
      }
    }

    if (shouldAggregateExternalSisa) {
      const sisaCfg = resolveToteatRestaurant(sisaSourceRestaurantId);
      if (sisaCfg) {
        try {
          externalSisaRows = await fetchSalesRowsForRestaurant(
            sisaCfg,
            startDate,
            endDate,
            externalSalesRetryOptions,
          );
          externalSisaName = sisaCfg.name;
        } catch (err) {
          externalSisaError = err instanceof Error ? err.message : String(err);
          console.error(
            `[toteat/dashboard] No se pudo sumar API Sisa (${sisaCfg.id}):`,
            err,
          );
        }
      }
    }

    const sourceAwareRows: ToteatSaleRow[] = [...allRows];
    if (externalLimanesasRows.length > 0) {
      sourceAwareRows.push(
        ...tagRowsForSource(
          externalLimanesasRows,
          limanesasSourceRestaurantId || "limanesas",
          "Limanesas",
        ),
      );
    }
    if (externalSisaRows.length > 0) {
      sourceAwareRows.push(
        ...tagRowsForSource(externalSisaRows, sisaSourceRestaurantId || "sisa", "Sisa"),
      );
    }

    const hourFilteredRows = sourceAwareRows.filter((r) =>
      matchesHourFilter(r.dateClosed, hourFrom, hourTo),
    );
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
    const byCalendarDay = new Map<string, { total: number; transacciones: number }>();
    const byWeek = new Map<string, { total: number; transacciones: number }>();
    const byMonth = new Map<string, { total: number; transacciones: number }>();
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

        const ymd = getClosedYmdLima(row.dateClosed);
        if (ymd) {
          bumpPeriodBucket(byCalendarDay, ymd, rowTotal);
          bumpPeriodBucket(byWeek, mondayOfWeek(ymd), rowTotal);
          bumpPeriodBucket(byMonth, ymd.slice(0, 7), rowTotal);
        }
      }

      for (const pm of row.paymentForms || []) {
        const name = pm.name?.trim() || "Sin medio";
        const current = methodMap.get(name) || { amount: 0, count: 0 };
        current.amount += safeNum(pm.amount);
        current.count += 1;
        methodMap.set(name, current);
      }

      const rowProducts = row.products || [];
      for (const p of rowProducts) {
        const name = p.name?.trim() || "Sin nombre";
        const current = productMap.get(name) || { quantity: 0, revenue: 0 };
        const quantity = safeNum(p.quantity);
        const payed = safeNum(p.payed);
        current.quantity += quantity;
        current.revenue += payed;
        productMap.set(name, current);
      }

      // APIs externas dedicadas (Sisa/Limanesas): mantener imputación por row.payed
      // para conservar consistencia con el cruce histórico ya validado.
      if (row.__forcedBusiness) {
        const forcedBiz = row.__forcedBusiness;
        businessTotals[forcedBiz] += safeNum(row.payed);
        if (row.orderId != null) businessOrders[forcedBiz].add(String(row.orderId));

        if (rowProducts.length > 0) {
          for (const p of rowProducts) {
            const quantity = safeNum(p.quantity);
            businessLines[forcedBiz] += quantity > 0 ? quantity : 1;
          }
        } else {
          businessLines[forcedBiz] += 1;
        }
        continue;
      }

      for (const p of rowProducts) {
        const quantity = safeNum(p.quantity);
        const payed = safeNum(p.payed);
        const biz = row.__forcedBusiness
          ? row.__forcedBusiness
          : forcedBusinessByApi
          ? forcedBusinessByApi
          : classifyByCategory(row.zoneName, p.hierarchyName, p.name);
        businessTotals[biz] += payed;
        businessLines[biz] += quantity > 0 ? quantity : 1;
        if (row.orderId != null) businessOrders[biz].add(String(row.orderId));
      }

      if (rowProducts.length === 0) {
        const fallbackBiz: InternalBusiness = row.__forcedBusiness
          ? row.__forcedBusiness
          : forcedBusinessByApi
          ? forcedBusinessByApi
          : isCafeteriaZone(row.zoneName)
            ? "Sisa"
            : "Refugio";
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

    const scopedBusinessTotals: Record<InternalBusiness, number> = { ...businessTotals };
    const scopedBusinessLines: Record<InternalBusiness, number> = { ...businessLines };
    const scopedBusinessOrders: Record<InternalBusiness, Set<string>> = {
      Sisa: new Set(businessOrders.Sisa),
      Limanesas: new Set(businessOrders.Limanesas),
      Refugio: new Set(businessOrders.Refugio),
    };
    if (businessScope !== "all") {
      const selectedBusiness: InternalBusiness =
        businessScope === "sisa" ? "Sisa" : businessScope === "limanesas" ? "Limanesas" : "Refugio";
      for (const business of ["Sisa", "Limanesas", "Refugio"] as InternalBusiness[]) {
        if (business === selectedBusiness) continue;
        scopedBusinessTotals[business] = 0;
        scopedBusinessLines[business] = 0;
        scopedBusinessOrders[business].clear();
      }
    }
    const businessSplitTotal =
      scopedBusinessTotals.Sisa + scopedBusinessTotals.Limanesas + scopedBusinessTotals.Refugio;

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
      const fiscalController = new AbortController();
      const fiscalTimeout = setTimeout(() => fiscalController.abort(), cfg.timeoutMs);
      try {
        const fiscalRes = await fetch(
          `${cfg.baseUrl}/fiscaldocuments?${baseParams.toString()}&ini=${toYmdCompact(startDate)}&end=${toYmdCompact(endDate)}`,
          { signal: fiscalController.signal },
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
      } finally {
        clearTimeout(fiscalTimeout);
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
        tendencia: {
          por_dia: mapTendenciaSeries(byCalendarDay, formatTendenciaDiaLabel),
          por_semana: mapTendenciaSeries(byWeek, formatTendenciaSemanaLabel),
          por_mes: mapTendenciaSeries(byMonth, formatTendenciaMesLabel),
        },
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
          "Detalle de ventas (zona + categoría) — no ventas por jerarquía",
          "zone/sector Cafeteria => Sisa",
          "fuera de Cafeteria: categoría o producto con 'Limanesa' => Limanesas",
          "fuera de Cafeteria: categoría 'Aperitivo Cafetería Sisa' o categoría 'Sisa' => Sisa (excluye 'Sisa Bar')",
          "resto => Refugio (Bar Refugio)",
          "monto asignado por línea usando products[].payed (estimado operativo)",
          ...(externalLimanesasRows.length > 0
            ? [
                `se suma API propia de Limanesas (${externalLimanesasName || limanesasSourceRestaurantId}) al bloque Limanesas`,
              ]
            : []),
          ...(shouldAggregateExternalLimanesas && externalLimanesasRows.length === 0 && externalLimanesasError
            ? [
                `no se pudo sumar API propia de Limanesas (${externalLimanesasName || limanesasSourceRestaurantId}): ${externalLimanesasError}`,
              ]
            : []),
          ...(externalSisaRows.length > 0
            ? [
                `se suma API propia de Sisa (${externalSisaName || sisaSourceRestaurantId}) al bloque Sisa`,
              ]
            : []),
          ...(shouldAggregateExternalSisa && externalSisaRows.length === 0 && externalSisaError
            ? [
                `no se pudo sumar API propia de Sisa (${externalSisaName || sisaSourceRestaurantId}): ${externalSisaError}`,
              ]
            : []),
          ...(forcedBusinessByApi
            ? [`API dedicada seleccionada: todo el cruce se imputa a ${forcedBusinessByApi}`]
            : []),
          ...(businessScope !== "all"
            ? [
                `filtro de restaurante aplicado: ${
                  businessScope === "sisa" ? "Sisa" : businessScope === "limanesas" ? "Limanesas" : "Bar Refugio"
                }`,
              ]
            : []),
        ],
        by_business: (["Sisa", "Limanesas", "Refugio"] as InternalBusiness[]).map((business) => ({
          business,
          total: Math.round(scopedBusinessTotals[business] * 100) / 100,
          percentage:
            businessSplitTotal > 0
              ? Math.round((scopedBusinessTotals[business] / businessSplitTotal) * 10000) / 100
              : 0,
          line_items: scopedBusinessLines[business],
          orders: scopedBusinessOrders[business].size,
          average_ticket: safeAverage(scopedBusinessTotals[business], scopedBusinessOrders[business].size),
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
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Timeout al consultar API Toteat (${cfg.timeoutMs}ms). Reduce el rango o aumenta TOTEAT_TIMEOUT_MS.`,
      );
    }
    throw err;
  }
}
