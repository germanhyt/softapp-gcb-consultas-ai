import { dataCache } from "./data-cache";

interface AuthResponse {
  access: string;
  refresh: string;
}

interface TransactionData {
  id: number;
  date: string;
  transaction_datetime: string | null;
  original_datetime: string | null;
  amount: string;
  source_type: string;
  card_type: string | null;
  auth_code: string | null;
  terminal_number: string | null;
  reconciliation_status: string;
}

export interface DashboardVentasResponse {
  year: number;
  months: Array<{
    month: string;       // "2026-01"
    label: string;       // "Enero 2026"
    negocios: Record<string, Record<string, number>>;
    totals: Record<string, number>;
  }>;
  year_total: Record<string, number>;
}

interface ReconciliationRecord {
  id: number;
  toteat_transaction: TransactionData;
  payment_transaction: TransactionData;
  match_method: string;
  created_at: string;
  is_manual: boolean;
  is_split: boolean;
  allocated_amount: string | null;
}

export class CuadreTarjetasClient {
  private baseUrl: string;
  private token: string | null = null;
  private username: string;
  private password: string;

  constructor() {
    this.baseUrl = process.env.CT_API_URL || "http://62.169.23.24:8082/api";
    this.username = process.env.CT_USERNAME || "";
    this.password = process.env.CT_PASSWORD || "";
  }

  private async authenticate(): Promise<void> {
    if (this.token) return;

    const cached = dataCache.get<string>("ct_token");
    if (cached) {
      this.token = cached;
      return;
    }

    try {
      const res = await fetch(`${this.baseUrl}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      });

      if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
      const data: AuthResponse = await res.json();
      this.token = data.access;
      dataCache.set("ct_token", this.token, 3600000); // 1 hour
    } catch (error) {
      console.error("[CuadreTarjetas] Auth error:", error);
      throw new Error("No se pudo autenticar con CuadreTarjetas API");
    }
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.authenticate();

    const cacheKey = `ct:${path}:${JSON.stringify(params || {})}`;
    const cached = dataCache.get<T>(cacheKey);
    if (cached) return cached;

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      // Token expired, retry
      this.token = null;
      dataCache.invalidate("ct_token");
      await this.authenticate();

      const retryRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      });
      if (!retryRes.ok) throw new Error(`API error: ${retryRes.status}`);
      const data = await retryRes.json();
      dataCache.set(cacheKey, data);
      return data as T;
    }

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    dataCache.set(cacheKey, data);
    return data as T;
  }

  // --- Tier 1: Consultas frecuentes ---
  async getDashboardStats(startDate: string, endDate: string, period = "daily") {
    return this.request("/reports/stats/", {
      start_date: startDate,
      end_date: endDate,
      period,
    });
  }

  async getCoverageReport(startDate: string, endDate: string) {
    return this.request("/reports/coverage/", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async getUnmatchedReport(startDate: string, endDate: string) {
    return this.request("/reports/unmatched/", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async getDailySummaries(instanceId?: number) {
    const params: Record<string, string> = {};
    if (instanceId) params.instance = String(instanceId);
    return this.request("/daily-summaries/", params);
  }

  async getMonthlyOverview(instanceId: number) {
    return this.request(`/daily-summaries/monthly_overview/`, {
      instance: String(instanceId),
    });
  }

  // --- Tier 2: Análisis detallado ---
  async getMethodStatistics(instanceId?: number) {
    const params: Record<string, string> = {};
    if (instanceId) params.instance = String(instanceId);
    return this.request("/reports/method-statistics/", params);
  }

  async getMonthlyCharts(startDate: string, endDate: string, period = "daily") {
    return this.request("/reports/monthly-charts/", {
      start_date: startDate,
      end_date: endDate,
      period,
    });
  }

  async getPendingDeposits() {
    return this.request("/processor-deposits/pending_dates/");
  }

  async getProblematicTransactions(startDate: string, endDate: string) {
    return this.request("/reports/problematic/", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // --- Tier 3: Información contextual ---
  async getReconciliations(
    startDate: string,
    endDate: string,
    maxPages = 5,
    instanceId?: number,
    sourceType?: string
  ): Promise<ReconciliationRecord[]> {
    const allResults: ReconciliationRecord[] = [];
    let page = 1;

    while (page <= maxPages) {
      const params: Record<string, string> = {
        start_date: startDate,
        end_date: endDate,
        page: String(page),
      };
      if (instanceId) params.instance = String(instanceId);
      if (sourceType) params.source_type = sourceType;

      const data = await this.request<{
        count: number;
        next: string | null;
        results: ReconciliationRecord[];
      }>("/reconciliations/", params);

      if (data.results && Array.isArray(data.results)) {
        allResults.push(...data.results);
        if (!data.next) break;
        page++;
      } else if (Array.isArray(data)) {
        // Non-paginated response
        return data as unknown as ReconciliationRecord[];
      } else {
        break;
      }
    }

    return allResults;
  }

  async getTransactions(params: Record<string, string>) {
    return this.request("/transactions/", params);
  }

  async getFilesByInstance(instanceId: number): Promise<Array<Record<string, unknown>>> {
    const resp = await this.request<{ results?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>("/files/", {
      instance: String(instanceId),
    });
    // API returns paginated { count, results: [...] } or plain array
    if (resp && !Array.isArray(resp) && Array.isArray((resp as { results?: unknown }).results)) {
      return (resp as { results: Array<Record<string, unknown>> }).results;
    }
    return Array.isArray(resp) ? resp : [];
  }

  async getTransactionSummaryByInstance(instanceId: number): Promise<{
    bySourceAndCard: Array<{ fuente: string; tipo_tarjeta: string; cantidad: number; total_monto: number }>;
    totalPorFuente: Array<{ fuente: string; cantidad: number; total_monto: number }>;
  }> {
    const allTx: TransactionData[] = [];
    let page = 1;

    while (page <= 5) {
      const params: Record<string, string> = {
        instance: String(instanceId),
        page: String(page),
        page_size: "500",
      };
      try {
        const data = await this.request<{
          count: number;
          next: string | null;
          results: TransactionData[];
        }>("/transactions/", params);

        if (data.results && Array.isArray(data.results)) {
          allTx.push(...data.results);
          if (!data.next) break;
          page++;
        } else if (Array.isArray(data)) {
          allTx.push(...(data as unknown as TransactionData[]));
          break;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // Aggregate by source_type + card_type
    const agg: Record<string, { cantidad: number; total: number }> = {};
    for (const tx of allTx) {
      const fuente = tx.source_type || "DESCONOCIDO";
      const tipo = tx.card_type || "SIN_TIPO";
      const key = `${fuente}||${tipo}`;
      if (!agg[key]) agg[key] = { cantidad: 0, total: 0 };
      agg[key].cantidad++;
      agg[key].total += parseFloat(tx.amount || "0");
    }

    const bySourceAndCard = Object.entries(agg).map(([key, v]) => {
      const [fuente, tipo_tarjeta] = key.split("||");
      return {
        fuente,
        tipo_tarjeta,
        cantidad: v.cantidad,
        total_monto: Math.round(v.total * 100) / 100,
      };
    }).sort((a, b) => a.fuente.localeCompare(b.fuente) || a.tipo_tarjeta.localeCompare(b.tipo_tarjeta));

    // Also aggregate by source only
    const byFuente: Record<string, { cantidad: number; total: number }> = {};
    for (const row of bySourceAndCard) {
      if (!byFuente[row.fuente]) byFuente[row.fuente] = { cantidad: 0, total: 0 };
      byFuente[row.fuente].cantidad += row.cantidad;
      byFuente[row.fuente].total += row.total_monto;
    }
    const totalPorFuente = Object.entries(byFuente).map(([fuente, v]) => ({
      fuente,
      cantidad: v.cantidad,
      total_monto: Math.round(v.total * 100) / 100,
    }));

    return { bySourceAndCard, totalPorFuente };
  }

  async getInstances() {
    const raw = await this.request<Array<Record<string, unknown>>>("/instances/");
    if (!Array.isArray(raw)) return raw;

    // Filter and simplify for AI context: only relevant fields, exclude ANNULLED
    return raw
      .filter((inst) => inst.status !== "ANNULLED")
      .map((inst) => ({
        id: inst.id,
        name: inst.name,          // keep 'name' for resolveInstanceId compatibility
        nombre: inst.name,
        descripcion: inst.description || "(sin descripción)",
        estado: inst.status,
        toteat_total: inst.toteat_total,
        toteat_conciliado: inst.toteat_conciliated,
        toteat_pendiente: inst.toteat_pending,
        vouchers_total: inst.vouchers_total,
        cobertura_pct: inst.toteat_percentage,
        fecha_inicio: inst.fecha_inicio ?? inst.created_at,
        fecha_cierre: inst.closed_at ?? "Abierta",
      }));
  }

  async getInstanceStats(instanceId: number) {
    return this.request("/reports/instance-stats/", {
      instance: String(instanceId),
    });
  }

  async getDataQuality(startDate: string, endDate: string) {
    return this.request("/reports/data-quality/", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // --- Dashboard de Ventas ---
  async getDashboardVentas(year: number, month?: number): Promise<DashboardVentasResponse> {
    const params: Record<string, string> = { year: String(year) };
    if (month) params.month = String(month);
    return this.request<DashboardVentasResponse>("/dashboard/toteat-summary/", params);
  }

  // --- Tier 4: Análisis avanzado ---
  async analyzeTimeDifferences(
    startDate: string,
    endDate: string,
    instanceId?: number
  ): Promise<Record<string, unknown>> {
    const reconciliations = await this.getReconciliations(startDate, endDate, 10, instanceId);

    if (!Array.isArray(reconciliations) || reconciliations.length === 0) {
      return { error: "No se encontraron reconciliaciones en el periodo" };
    }

    const diffs: Array<{
      hour: number;
      diffMinutes: number;
      toteatTime: string;
      voucherTime: string;
      amount: string;
      method: string;
      source: string;
    }> = [];

    for (const rec of reconciliations) {
      const toteatDt = rec.toteat_transaction?.transaction_datetime || rec.toteat_transaction?.original_datetime;
      const paymentDt = rec.payment_transaction?.transaction_datetime || rec.payment_transaction?.original_datetime;

      if (!toteatDt || !paymentDt) continue;

      const toteatDate = new Date(toteatDt);
      const paymentDate = new Date(paymentDt);
      const diffMs = Math.abs(paymentDate.getTime() - toteatDate.getTime());
      const diffMinutes = Math.round(diffMs / 60000);

      diffs.push({
        hour: toteatDate.getHours(),
        diffMinutes,
        toteatTime: toteatDt,
        voucherTime: paymentDt,
        amount: rec.toteat_transaction.amount,
        method: rec.match_method,
        source: rec.payment_transaction.source_type,
      });
    }

    if (diffs.length === 0) {
      return { error: "Las reconciliaciones no tienen timestamps detallados" };
    }

    // Group by hour
    const byHour: Record<number, { count: number; totalDiff: number; maxDiff: number; over60min: number }> = {};
    for (let h = 0; h < 24; h++) {
      byHour[h] = { count: 0, totalDiff: 0, maxDiff: 0, over60min: 0 };
    }

    for (const d of diffs) {
      const h = d.hour;
      byHour[h].count++;
      byHour[h].totalDiff += d.diffMinutes;
      byHour[h].maxDiff = Math.max(byHour[h].maxDiff, d.diffMinutes);
      if (d.diffMinutes > 60) byHour[h].over60min++;
    }

    // Build summary
    const hourlyTable = Object.entries(byHour)
      .filter(([, v]) => v.count > 0)
      .map(([hour, v]) => ({
        hora: `${hour.padStart(2, "0")}:00-${hour.padStart(2, "0")}:59`,
        transacciones: v.count,
        diff_promedio_min: Math.round(v.totalDiff / v.count),
        diff_max_min: v.maxDiff,
        mayor_60min: v.over60min,
        pct_mayor_60min: `${((v.over60min / v.count) * 100).toFixed(1)}%`,
      }));

    // Top outliers (>60 min)
    const outliers = diffs
      .filter((d) => d.diffMinutes > 60)
      .sort((a, b) => b.diffMinutes - a.diffMinutes)
      .slice(0, 20)
      .map((d) => ({
        hora_toteat: d.toteatTime,
        hora_voucher: d.voucherTime,
        diferencia_min: d.diffMinutes,
        monto: `S/ ${d.amount}`,
        metodo: d.method,
        procesador: d.source,
      }));

    const totalWithTimestamp = diffs.length;
    const totalOver60 = diffs.filter((d) => d.diffMinutes > 60).length;
    const avgDiff = Math.round(diffs.reduce((s, d) => s + d.diffMinutes, 0) / diffs.length);

    return {
      resumen: {
        total_pares_analizados: totalWithTimestamp,
        total_con_diff_mayor_60min: totalOver60,
        porcentaje_mayor_60min: `${((totalOver60 / totalWithTimestamp) * 100).toFixed(1)}%`,
        diferencia_promedio_minutos: avgDiff,
        diferencia_maxima_minutos: Math.max(...diffs.map((d) => d.diffMinutes)),
      },
      distribucion_por_hora: hourlyTable,
      top_diferencias_mayores: outliers,
    };
  }

  // --- Tier 5: Depósitos bancarios y efectivo ---
  async getBankDeposits(instanceId?: number, status?: string): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (instanceId) params.instance = String(instanceId);
    if (status) params.status = status;
    const data = await this.request<{ results?: unknown[]; count?: number } | unknown[]>(
      "/bank-deposits/", params
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  }

  async getProcessorDeposits(
    startDate?: string, endDate?: string, status?: string, instanceId?: number
  ): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (startDate) params.fecha_inicio = startDate;
    if (endDate) params.fecha_fin = endDate;
    if (status) params.status = status;
    if (instanceId) params.instance_id = String(instanceId);
    const data = await this.request<{ results?: unknown[]; count?: number } | unknown[]>(
      "/processor-deposits/", params
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  }

  async getProcessorDepositsSummary(
    startDate?: string, endDate?: string, instanceId?: number
  ): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {};
    if (startDate) params.fecha_inicio = startDate;
    if (endDate) params.fecha_fin = endDate;
    if (instanceId) params.instance_id = String(instanceId);
    return this.request<Record<string, unknown>>("/processor-deposits/summary/", params);
  }

  async getCashReconciliations(instanceId?: number): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (instanceId) params.instance = String(instanceId);
    const data = await this.request<{ results?: unknown[]; count?: number } | unknown[]>(
      "/cash-reconciliations/", params
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  }

  async getCashReconciliationDays(instanceId: number): Promise<unknown[]> {
    return this.request<unknown[]>("/cash-reconciliations/days/", {
      instance: String(instanceId),
    });
  }

  async getReconciliationExecutions(instanceId?: number): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (instanceId) params.instance_id = String(instanceId);
    const data = await this.request<{ results?: unknown[]; count?: number } | unknown[]>(
      "/executions/", params
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  }

  async getHourlyDistribution(dailySummaryId: number): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/daily-summaries/${dailySummaryId}/hourly_distribution/`
    );
  }

  // --- Formatting for AI ---
  formatForAI(data: Record<string, unknown>): string {
    const sections: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (!value) continue;
      sections.push(`### ${this.formatSectionTitle(key)}`);
      sections.push(this.formatValue(value));
    }

    return sections.join("\n\n");
  }

  private formatSectionTitle(key: string): string {
    const titles: Record<string, string> = {
      dashboardStats: "Estadísticas del Dashboard",
      coverage: "Reporte de Cobertura",
      unmatched: "Vouchers Sin Conciliar",
      dailySummaries: "Resúmenes Diarios",
      monthlyOverview: "Vista Mensual",
      methodStats: "Estadísticas por Algoritmo",
      monthlyCharts: "Tendencias Históricas",
      pendingDeposits: "Depósitos Pendientes",
      problematic: "Transacciones Problemáticas",
      instances: "Instancias/Periodos",
      dataQuality: "Calidad de Datos",
      timeDifferences: "Análisis de Diferencias Horarias",
      reconciliations: "Reconciliaciones Detalladas",
      instanceFiles: "Archivos Cargados en la Instancia",
      instanceTransactions: "Transacciones por Fuente y Tipo de Tarjeta",
      instanceFileSummary: "Archivos y Totales de la Instancia",
      bankDeposits: "Depósitos Bancarios",
      processorDepositsSummary: "Resumen de Depósitos de Procesadores (Niubiz/AMEX/Diners)",
      cashReconciliationDays: "Días con Efectivo y Estado de Conciliación",
      reconciliationExecutions: "Historial de Ejecuciones de Algoritmos",
      hourlyDistribution: "Distribución Horaria de Transacciones",
    };
    return titles[key] || key;
  }

  private formatValue(value: unknown, indent = 0): string {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      if (value.length === 0) return "Sin datos";
      if (value.length <= 20 && typeof value[0] === "object") {
        return this.formatAsTable(value as Record<string, unknown>[]);
      }
      return value
        .slice(0, 30)
        .map((v) => `${"  ".repeat(indent)}- ${this.formatValue(v, indent + 1)}`)
        .join("\n");
    }
    if (typeof value === "object") {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${"  ".repeat(indent)}**${k}**: ${this.formatValue(v, indent + 1)}`)
        .join("\n");
    }
    return String(value);
  }

  private formatAsTable(items: Record<string, unknown>[]): string {
    if (items.length === 0) return "Sin datos";

    const keys = Object.keys(items[0]);
    const header = `| ${keys.join(" | ")} |`;
    const separator = `| ${keys.map(() => "---").join(" | ")} |`;
    const rows = items.map(
      (item) => `| ${keys.map((k) => this.formatValue(item[k])).join(" | ")} |`
    );

    return [header, separator, ...rows].join("\n");
  }
}

// Singleton
let clientInstance: CuadreTarjetasClient | null = null;

export function getCuadreTarjetasClient(): CuadreTarjetasClient {
  if (!clientInstance) {
    clientInstance = new CuadreTarjetasClient();
  }
  return clientInstance;
}
