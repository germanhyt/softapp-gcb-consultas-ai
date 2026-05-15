import { getCuadreTarjetasClient } from "@/lib/data/cuadre-tarjetas-client";
import { executeBigQuery, formatQueryResult } from "@/lib/data/bigquery-client";
import { generateSQL } from "./sql-generator";
import { getSystemPrompt, type ModuleType } from "./system-prompts";

interface ContextResult {
  module: ModuleType;
  data: string;
  systemPrompt: string;
}

// Keyword patterns for module detection
const MODULE_KEYWORDS: Record<ModuleType, RegExp[]> = {
  cuadre_tarjetas: [
    /concilia/i,
    /cuadre/i,
    /tarjeta/i,
    /voucher/i,
    /niubiz/i,
    /amex/i,
    /american\s*express/i,
    /diners/i,
    /cobertura/i,
    /hu[eé]rfano/i,
    /procesador/i,
    /pos\s*terminal/i,
    /algoritmo/i,
    /scoring/i,
    /gen[eé]tico/i,
    /heur[ií]stico/i,
    /toteat/i,
    /dep[oó]sito/i,
    /abono/i,
    /instancia/i,
    /sin\s*match/i,
    /no\s*conciliado/i,
    /pendiente.*tarjeta/i,
    /banco|bancario/i,
    /bcp|interbank|bbva|scotiabank/i,
    /efectivo|cash/i,
    /comisi[oó]n/i,
    /ejecuci[oó]n.*algoritmo/i,
    /terminal/i,
  ],
  ventas: [
    /venta|vente|vend/i,
    /producto/i,
    /categor[ií]a/i,
    /ingreso/i,
    /ticket/i,
    /mesa/i,
    /factura/i,
    /boleta/i,
    /comanda/i,
    /plato/i,
    /negocio/i,
    /\bbar\b/i,
    /refugio/i,
    /cuanto\s+(se\s+)?(vend|gan)/i,
    /recaud/i,
    /turno/i,
    /horario/i,
  ],
  estacionamiento: [
    /estacionamiento/i,
    /veh[ií]culo/i,
    /placa/i,
    /parking/i,
    /auto/i,
    /cochera/i,
  ],
  flujo: [
    /flujo/i,
    /persona/i,
    /aforo/i,
    /visitante/i,
    /conteo/i,
    /sensor/i,
  ],
  general: [],
};

// Data fetch patterns for CuadreTarjetas
const CT_FETCH_PATTERNS: Array<{
  pattern: RegExp;
  methods: string[];
}> = [
  {
    pattern: /concilia|cuadre|resumen|dashboard|estad[ií]stica/i,
    methods: ["getDashboardStats"],
  },
  {
    pattern: /cobertura|coverage|porcentaje.*concilia/i,
    methods: ["getCoverageReport"],
  },
  {
    pattern: /hu[eé]rfano|sin\s*match|no\s*conciliado|pendiente/i,
    methods: ["getUnmatchedReport"],
  },
  {
    pattern: /d[ií]a|diario|daily|hoy|ayer|resumen\s*del\s*d[ií]a/i,
    methods: ["getDailySummaries"],
  },
  {
    pattern: /mes|mensual|monthly|tendencia|hist[oó]ric/i,
    methods: ["getMonthlyCharts"],
  },
  {
    pattern: /algoritmo|m[eé]todo|scoring|gen[eé]tico|heur[ií]stic/i,
    methods: ["getMethodStatistics"],
  },
  {
    pattern: /dep[oó]sito.*banc|banc.*dep[oó]sito|cuenta\s*bancaria|bcp|interbank|bbva|scotiabank|voucher.*dep[oó]sito/i,
    methods: ["getBankDeposits"],
  },
  {
    pattern: /efectivo|cash|caja.*efectivo|concilia.*efectivo|efectivo.*concilia|d[ií]as.*efectivo|efectivo.*pendiente/i,
    methods: ["getCashReconciliationDays"],
  },
  {
    pattern: /niubiz.*dep|dep.*niubiz|procesador.*dep|dep.*procesador|comisi[oó]n.*tarjeta|comisi[oó]n.*niubiz|neto|abono.*niubiz|d[ií]as.*dep[oó]sito/i,
    methods: ["getProcessorDepositsSummary"],
  },
  {
    pattern: /dep[oó]sito|abono/i,
    methods: ["getPendingDeposits", "getBankDeposits", "getProcessorDepositsSummary"],
  },
  {
    pattern: /ejecuci[oó]n|corrida|historial.*algoritmo|algoritmo.*historial|audit.*concilia|rendimiento.*algoritmo|cu[aá]nto\s*tard|duraci[oó]n.*concilia/i,
    methods: ["getReconciliationExecutions"],
  },
  {
    pattern: /terminal|caja\s*registradora|pos.*n[uú]mero|n[uú]mero.*terminal|por\s*caja|por\s*terminal/i,
    methods: ["getReconciliationExecutions", "getDailySummaries"],
  },
  {
    pattern: /problema|error|anomal[ií]a|discrepancia/i,
    methods: ["getProblematicTransactions"],
  },
  {
    pattern: /instancia|periodo|per[ií]odo/i,
    methods: ["getInstances"],
  },
  {
    pattern: /archivo|columna|excel|total.*fuente|fuente.*total|detalle.*transacci|transacci.*detalle|desglose|por\s*tipo|\bboleta\b/i,
    methods: ["getInstanceFileSummary"],
  },
  {
    pattern: /calidad|quality|integridad/i,
    methods: ["getDataQuality"],
  },
  {
    pattern: /hora|horario|tiempo|diferencia.*hora|desfase|timestamp|demora|retraso|rango.*hora/i,
    methods: ["analyzeTimeDifferences"],
  },
  {
    pattern: /reconcilia.*detall|detalle.*concilia|pares|match.*detall/i,
    methods: ["getReconciliations"],
  },
];

/**
 * Normalize text for pattern matching: strip accents and normalize Unicode.
 * Returns the accent-stripped version so patterns like /deposito/ match "depósito".
 */
function normalizeForMatch(text: string): string {
  return text
    .normalize("NFC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");  // strip combining accents → ó→o, é→e, etc.
}

/**
 * Test a regex pattern against a message, trying multiple text representations
 * to handle encoding issues (e.g. ó → U+FFFD from bad encoding).
 */
function testPattern(pattern: RegExp, message: string, normalizedMsg: string): boolean {
  if (pattern.test(message) || pattern.test(normalizedMsg)) return true;
  // Handle U+FFFD replacement chars from bad encoding
  if (message.includes("\uFFFD")) {
    for (const vowel of ["a", "e", "i", "o", "u", "n"]) {
      if (pattern.test(message.replace(/\uFFFD/g, vowel))) return true;
    }
  }
  return false;
}

function detectModule(message: string): ModuleType {
  let bestModule: ModuleType = "general";
  let bestScore = 0;
  const normalizedMsg = normalizeForMatch(message);

  for (const [mod, patterns] of Object.entries(MODULE_KEYWORDS) as [ModuleType, RegExp[]][]) {
    if (mod === "general") continue;
    const score = patterns.filter((p) => testPattern(p, message, normalizedMsg)).length;
    if (score > bestScore) {
      bestScore = score;
      bestModule = mod;
    }
  }

  return bestModule;
}

const MONTH_MAP: Record<string, number> = {
  enero: 0, january: 0,
  febrero: 1, february: 1,
  marzo: 2, march: 2,
  abril: 3, april: 3,
  mayo: 4, may: 4,
  junio: 5, june: 5,
  julio: 6, july: 6,
  agosto: 7, august: 7,
  septiembre: 8, september: 8,
  octubre: 9, october: 9,
  noviembre: 10, november: 10,
  diciembre: 11, december: 11,
};

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function parseDateToken(token: string, now: Date): Date | null {
  // DD/MM/YYYY or D/M/YYYY
  const dmy = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  // YYYY-MM-DD
  const ymd = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
  // "hoy" / "today" / "dia actual" / "fecha actual"
  if (/^(hoy|today)$/.test(token)) return new Date(now);
  return null;
}

function getDateRange(message?: string): { startDate: string; endDate: string } {
  const now = new Date();

  if (message) {
    // ── Try to extract explicit date range "desde X hasta Y" / "del X al Y" ──
    const rangeMatch = message.match(
      /(?:desde|del?|from)\s+(?:el\s+)?([\d\/\-]+|hoy|today)\s+(?:hasta|al?|to|(?:el\s+)?d[ií]a\s+(?:actual|de\s+hoy))\s+([\d\/\-]+|hoy|today|d[ií]a\s+actual)/i
    );
    if (rangeMatch) {
      const s = parseDateToken(rangeMatch[1], now);
      const eToken = rangeMatch[2].replace(/\s+/g, "");
      const e = /d[ií]aactual/i.test(eToken) ? now : (parseDateToken(eToken, now) ?? now);
      if (s) return { startDate: toISODate(s), endDate: toISODate(e) };
    }

    // ── Detect "hasta el dia actual / hoy" → endDate = today ──
    const hasUntilToday = /hasta\s+(el\s+)?(d[ií]a\s+)?(actual|de\s+hoy|hoy)|al\s+d[ií]a\s+de\s+hoy/i.test(message);

    // ── Try individual date tokens (DD/MM/YYYY) ──
    const dateTokens = [...message.matchAll(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g)].map((m) => m[1]);
    if (dateTokens.length >= 2) {
      const d1 = parseDateToken(dateTokens[0], now);
      const d2 = parseDateToken(dateTokens[1], now);
      if (d1 && d2) return { startDate: toISODate(d1 < d2 ? d1 : d2), endDate: toISODate(d1 < d2 ? d2 : d1) };
    }
    if (dateTokens.length === 1) {
      const d1 = parseDateToken(dateTokens[0], now);
      if (d1) {
        const end = hasUntilToday ? now : d1;
        return { startDate: toISODate(d1 < end ? d1 : end), endDate: toISODate(d1 < end ? end : d1) };
      }
    }

    // ── Month name detection ──
    const lowerMsg = message.toLowerCase();
    for (const [name, monthIdx] of Object.entries(MONTH_MAP)) {
      if (lowerMsg.includes(name)) {
        const yearMatch = message.match(/\b(202\d)\b/);
        let year = now.getFullYear();
        if (yearMatch) {
          year = parseInt(yearMatch[1]);
        } else if (monthIdx > now.getMonth()) {
          year = year - 1;
        }
        const firstDay = new Date(year, monthIdx, 1);
        const lastDay = new Date(year, monthIdx + 1, 0);
        return { startDate: toISODate(firstDay), endDate: toISODate(lastDay) };
      }
    }

    // ── Year / period detection ──
    const normalizedLower = normalizeForMatch(message).toLowerCase();
    // "último año", "ultimo ano", "last year", "este año", "anual"
    if (/ultim[oa]\s*a[nñ]o|last\s*year/i.test(normalizedLower)) {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return { startDate: toISODate(start), endDate: toISODate(now) };
    }
    if (/este\s*a[nñ]o|this\s*year|del\s*a[nñ]o\b/i.test(normalizedLower)) {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: toISODate(start), endDate: toISODate(now) };
    }
    // "año 2025", "2025"
    const yearOnlyMatch = message.match(/\ba[nñ]o\s*(202\d)\b|\b(202\d)\b/i);
    if (yearOnlyMatch) {
      const y = parseInt(yearOnlyMatch[1] || yearOnlyMatch[2]);
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
    }
    // "últimos N meses", "últimos N días"
    const lastNMatch = normalizedLower.match(/ultim[oa]s?\s*(\d+)\s*(mes|dia|semana)/);
    if (lastNMatch) {
      const n = parseInt(lastNMatch[1]);
      const unit = lastNMatch[2];
      const start = new Date(now);
      if (unit.startsWith("mes")) start.setMonth(start.getMonth() - n);
      else if (unit.startsWith("dia")) start.setDate(start.getDate() - n);
      else if (unit.startsWith("semana")) start.setDate(start.getDate() - n * 7);
      return { startDate: toISODate(start), endDate: toISODate(now) };
    }
  }

  // Default: last 30 days
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

async function resolveInstanceId(client: ReturnType<typeof getCuadreTarjetasClient>, message: string): Promise<number | undefined> {
  const lowerMsg = normalizeForMatch(message).toLowerCase();
  if (!lowerMsg.includes("instancia") && !lowerMsg.includes("instance")) return undefined;

  // First: try direct numeric ID ("instancia 14", "instancia #14", "instancia id 14")
  const numericMatch = message.match(/instancias?\s*(?:#|id\s*)?(\d+)/i);
  if (numericMatch) return parseInt(numericMatch[1]);

  try {
    const instances = await client.getInstances() as Array<{ id: number; name: string }>;
    if (!Array.isArray(instances)) return undefined;

    // Find matching instance by month name in message
    for (const [monthName] of Object.entries(MONTH_MAP)) {
      if (lowerMsg.includes(monthName)) {
        const match = instances.find((inst) =>
          inst.name.toLowerCase().includes(monthName)
        );
        if (match) return match.id;
      }
    }

    // Try direct instance name match
    const matched = instances.find((inst) =>
      lowerMsg.includes(inst.name.toLowerCase())
    );
    return matched?.id;
  } catch {
    return undefined;
  }
}

async function fetchCuadreTarjetasData(message: string): Promise<string> {
  const client = getCuadreTarjetasClient();
  const { startDate, endDate } = getDateRange(message);
  const results: Record<string, unknown> = {};

  // Determine which methods to call based on message keywords
  const methodsToCall = new Set<string>();
  const normalizedMsg = normalizeForMatch(message);

  for (const { pattern, methods } of CT_FETCH_PATTERNS) {
    if (testPattern(pattern, message, normalizedMsg)) {
      methods.forEach((m) => methodsToCall.add(m));
    }
  }

  // If no specific pattern matched, fetch dashboard stats as default
  if (methodsToCall.size === 0) {
    methodsToCall.add("getDashboardStats");
  }

  // Execute fetches in parallel
  const fetchPromises: Promise<void>[] = [];

  const logErr = (method: string) => (e: unknown) => {
    console.error(`[ContextBuilder] ${method} failed:`, e);
  };

  if (methodsToCall.has("getDashboardStats")) {
    fetchPromises.push(
      client.getDashboardStats(startDate, endDate).then((d) => {
        results.dashboardStats = d;
      }).catch(logErr("getDashboardStats"))
    );
  }
  if (methodsToCall.has("getCoverageReport")) {
    fetchPromises.push(
      client.getCoverageReport(startDate, endDate).then((d) => {
        results.coverage = d;
      }).catch(logErr("getCoverageReport"))
    );
  }
  if (methodsToCall.has("getUnmatchedReport")) {
    fetchPromises.push(
      client.getUnmatchedReport(startDate, endDate).then((d) => {
        results.unmatched = d;
      }).catch(logErr("getUnmatchedReport"))
    );
  }
  if (methodsToCall.has("getDailySummaries")) {
    fetchPromises.push(
      client.getDailySummaries().then((d) => {
        results.dailySummaries = d;
      }).catch(logErr("getDailySummaries"))
    );
  }
  if (methodsToCall.has("getMonthlyCharts")) {
    fetchPromises.push(
      client.getMonthlyCharts(startDate, endDate).then((d) => {
        results.monthlyCharts = d;
      }).catch(logErr("getMonthlyCharts"))
    );
  }
  if (methodsToCall.has("getMethodStatistics")) {
    fetchPromises.push(
      client.getMethodStatistics().then((d) => {
        results.methodStats = d;
      }).catch(logErr("getMethodStatistics"))
    );
  }
  if (methodsToCall.has("getPendingDeposits")) {
    fetchPromises.push(
      client.getPendingDeposits().then((d) => {
        results.pendingDeposits = d;
      }).catch(logErr("getPendingDeposits"))
    );
  }
  if (methodsToCall.has("getBankDeposits")) {
    fetchPromises.push(
      resolveInstanceId(client, message).then((instanceId) =>
        client.getBankDeposits(instanceId)
      ).then((d) => {
        const limited = Array.isArray(d) ? d.slice(0, 30) : d;
        results.bankDeposits = limited;
      }).catch(logErr("getBankDeposits"))
    );
  }
  if (methodsToCall.has("getProcessorDepositsSummary")) {
    fetchPromises.push(
      resolveInstanceId(client, message).then((instanceId) =>
        client.getProcessorDepositsSummary(startDate, endDate, instanceId)
      ).then((d) => {
        results.processorDepositsSummary = d;
      }).catch(logErr("getProcessorDepositsSummary"))
    );
  }
  if (methodsToCall.has("getCashReconciliationDays")) {
    fetchPromises.push(
      resolveInstanceId(client, message).then(async (instanceId) => {
        if (!instanceId) {
          try {
            const instances = await client.getInstances() as Array<{ id: number; estado: string }>;
            const openInstance = instances?.find((i) => i.estado === "OPEN");
            if (openInstance) {
              results.cashReconciliationDays = await client.getCashReconciliationDays(openInstance.id);
              return;
            }
          } catch (e) {
            console.error("[ContextBuilder] getCashReconciliationDays instance lookup failed:", e);
          }
          results.cashReconciliationDays = "No se pudo determinar la instancia para consultar efectivo. Especifica la instancia (ej: 'instancia 14').";
          return;
        }
        results.cashReconciliationDays = await client.getCashReconciliationDays(instanceId);
      }).catch(logErr("getCashReconciliationDays"))
    );
  }
  if (methodsToCall.has("getReconciliationExecutions")) {
    fetchPromises.push(
      resolveInstanceId(client, message).then((instanceId) =>
        client.getReconciliationExecutions(instanceId)
      ).then((d) => {
        const limited = Array.isArray(d) ? d.slice(0, 30) : d;
        results.reconciliationExecutions = limited;
      }).catch(logErr("getReconciliationExecutions"))
    );
  }
  if (methodsToCall.has("getProblematicTransactions")) {
    fetchPromises.push(
      client.getProblematicTransactions(startDate, endDate).then((d) => {
        results.problematic = d;
      }).catch(logErr("getProblematicTransactions"))
    );
  }
  if (methodsToCall.has("getInstances")) {
    fetchPromises.push(
      client.getInstances().then((d) => {
        results.instances = d;
      }).catch(logErr("getInstances"))
    );
  }
  if (methodsToCall.has("getDataQuality")) {
    fetchPromises.push(
      client.getDataQuality(startDate, endDate).then((d) => {
        results.dataQuality = d;
      }).catch(logErr("getDataQuality"))
    );
  }
  if (methodsToCall.has("analyzeTimeDifferences")) {
    fetchPromises.push(
      resolveInstanceId(client, message).then((instanceId) =>
        client.analyzeTimeDifferences(startDate, endDate, instanceId)
      ).then((d) => {
        results.timeDifferences = d;
      }).catch((e) => {
        console.error("[ContextBuilder] Time diff analysis error:", e);
      })
    );
  }
  if (methodsToCall.has("getReconciliations")) {
    fetchPromises.push(
      client.getReconciliations(startDate, endDate).then((d) => {
        // Limit to 50 records for context size
        const limited = Array.isArray(d) ? d.slice(0, 50) : d;
        results.reconciliations = limited;
      }).catch(() => {})
    );
  }
  if (methodsToCall.has("getInstanceFileSummary")) {
    fetchPromises.push(
      resolveInstanceId(client, message).then(async (instanceId) => {
        if (!instanceId) {
          results.instanceFileSummary = "No se pudo determinar la instancia. Especifica el número (ej: 'instancia 14').";
          return;
        }
        const [files, txSummary] = await Promise.all([
          client.getFilesByInstance(instanceId).catch(() => [] as Array<Record<string, unknown>>),
          client.getTransactionSummaryByInstance(instanceId).catch(() => null),
        ]);

        // Pre-format as compact markdown to avoid huge AI responses
        const lines: string[] = [`**Instancia ID ${instanceId}**\n`];

        // Files table + original_metadata per file
        if (Array.isArray(files) && files.length > 0) {
          lines.push("**Archivos cargados:**");
          lines.push("| Archivo | Fuente | Estado | Filas |");
          lines.push("|---------|--------|--------|-------|");
          for (const f of files) {
            lines.push(`| ${f.original_filename ?? f.filename ?? "(sin nombre)"} | ${f.source_type ?? "—"} | ${f.status ?? "—"} | ${f.row_count ?? f.transaction_count ?? "—"} |`);
          }
          lines.push("");

          // Include original_metadata (column-level stats from the original Excel)
          for (const f of files) {
            const meta = f.original_metadata as Record<string, unknown> | null;
            if (!meta) continue;

            // Extract filename from file path (e.g. "uploads/2025/03/01/Reporte.xlsx" → "Reporte.xlsx")
            const filePath = String(f.file ?? "");
            const extractedName = filePath.split("/").pop() || filePath.split("\\").pop() || "";
            const fname = String(f.original_filename ?? f.filename ?? (extractedName || `Archivo #${f.id}`));
            const src = String(f.source_type ?? "");

            lines.push(`**Metadata del archivo: ${fname} (${src})**`);
            lines.push(`- Total registros: ${meta.total_records ?? "—"}`);
            lines.push(`- Monto total: S/ ${typeof meta.total_amount === "number" ? meta.total_amount.toFixed(2) : meta.total_amount ?? "—"}`);

            // TOTEAT: column_statistics
            const colStats = meta.column_statistics as Record<string, { total: number; count_with_value: number; percentage: number }> | undefined;
            if (colStats && Object.keys(colStats).length > 0) {
              if (meta.formula_used) lines.push(`- Fórmula aplicada: ${meta.formula_used}`);
              lines.push("- Estadísticas por columna del Excel:");
              lines.push("| Columna | Total (S/) | Comandas con valor | % |");
              lines.push("|---------|-----------|-------------------|---|");
              for (const [col, stats] of Object.entries(colStats)) {
                lines.push(`| ${col} | ${stats.total.toFixed(2)} | ${stats.count_with_value} | ${stats.percentage}% |`);
              }
            }

            // NIUBIZ/otros: by_card_type
            const byCard = meta.by_card_type as Record<string, { count: number; amount: number }> | undefined;
            if (byCard && Object.keys(byCard).length > 0) {
              lines.push("- Desglose por tipo de tarjeta:");
              lines.push("| Tarjeta | Cantidad | Monto (S/) |");
              lines.push("|---------|----------|-----------|");
              for (const [card, data] of Object.entries(byCard)) {
                lines.push(`| ${card.toUpperCase()} | ${data.count} | ${data.amount.toFixed(2)} |`);
              }
            }

            lines.push("");
          }
        }

        // Pre-calculate consolidated column totals across all TOTEAT files
        const columnTotals: Record<string, number> = {};
        for (const f of files) {
          const srcType = String(f.source_type ?? "");
          if (!srcType.toUpperCase().includes("TOTEAT")) continue;
          const meta = f.original_metadata as Record<string, unknown> | null;
          if (!meta) continue;
          const colStats = meta.column_statistics as Record<string, { total: number }> | undefined;
          if (!colStats) continue;
          for (const [col, stats] of Object.entries(colStats)) {
            columnTotals[col] = (columnTotals[col] ?? 0) + stats.total;
          }
        }
        if (Object.keys(columnTotals).length > 0) {
          lines.push("**Totales consolidados por columna (suma de todos los archivos TOTEAT):**");
          lines.push("| Columna | Total (S/) |");
          lines.push("|---------|-----------|");
          for (const [col, total] of Object.entries(columnTotals)) {
            lines.push(`| ${col} | ${total.toFixed(2)} |`);
          }
          lines.push("");
        }

        // Transaction totals table (from DB, as cross-check)
        if (txSummary && txSummary.totalPorFuente.length > 0) {
          lines.push("**Totales en BD por fuente (conciliados + pendientes):**");
          lines.push("| Fuente | Total Transacciones | Monto Total (S/) |");
          lines.push("|--------|---------------------|-----------------|");
          for (const row of txSummary.totalPorFuente) {
            lines.push(`| ${row.fuente} | ${row.cantidad} | ${row.total_monto.toFixed(2)} |`);
          }
        }

        results.instanceFileSummary = lines.join("\n");
      }).catch((e) => {
        console.error("[ContextBuilder] Instance file summary error:", e);
      })
    );
  }

  await Promise.all(fetchPromises);

  if (Object.keys(results).length === 0) {
    return "No se pudieron obtener datos del sistema de conciliación.";
  }

  return client.formatForAI(results);
}

async function fetchBigQueryData(
  userMessage: string,
  module: "ventas" | "estacionamiento" | "flujo"
): Promise<string> {
  const { startDate, endDate } = getDateRange(userMessage);
  const dateHint = `desde ${startDate} hasta ${endDate}`;

  // Try up to 2 attempts: generate SQL, execute, retry on error
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { sql, error } = await generateSQL(userMessage, module, dateHint, lastError);

    if (error || !sql) {
      console.error(`[ContextBuilder] SQL generation error (attempt ${attempt + 1}):`, error);
      lastError = error || "resultado vacío";
      continue;
    }

    console.log(`[ContextBuilder] Generated SQL (attempt ${attempt + 1}) for ${module}:`, sql);

    try {
      const result = await executeBigQuery(sql);
      const table = formatQueryResult(result);
      return `**Consulta ejecutada:** \`\`\`sql\n${sql}\n\`\`\`\n\n**Resultados (${result.rowCount} filas):**\n\n${table}`;
    } catch (err) {
      console.error(`[ContextBuilder] BigQuery error (attempt ${attempt + 1}):`, err);
      lastError = String(err);
    }
  }

  return `[ERROR_TECNICO] Error al consultar BigQuery después de 2 intentos: ${lastError}`;
}

export async function buildContext(userMessage: string): Promise<ContextResult> {
  const module = detectModule(userMessage);
  let data = "";

  if (module === "cuadre_tarjetas") {
    try {
      data = await fetchCuadreTarjetasData(userMessage);
    } catch (error) {
      console.error("[ContextBuilder] Error fetching CT data:", error);
      data = "Error al obtener datos de CuadreTarjetas. El sistema puede no estar disponible.";
    }
  } else if (module === "ventas" || module === "estacionamiento" || module === "flujo") {
    try {
      data = await fetchBigQueryData(userMessage, module);
    } catch (error) {
      console.error("[ContextBuilder] Error fetching BigQuery data:", error);
      data = `Error al consultar BigQuery para módulo ${module}: ${String(error)}`;
    }
  }

  const systemPrompt = getSystemPrompt(module);

  return { module, data, systemPrompt };
}
