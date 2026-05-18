import type { VentasReportPeriodPreset } from "./types";

const LIMA_TZ = "America/Lima";

function ymdInLima(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addCalendarDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + delta, 12, 0, 0));
  const yy = next.getUTCFullYear();
  const mm = next.getUTCMonth() + 1;
  const dd = next.getUTCDate();
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** DD/MM/YYYY legible y parseable por getDateRange (evita "may" → mes completo en inglés). */
function formatDisplayDmy(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Marcador para que BigQuery use el mismo rango que el scheduler (prioridad en context-builder). */
export function ventasIsoRangeMarker(start: string, end: string): string {
  return `[VENTAS_RANGO_ISO:${start}..${end}]`;
}

/** Lunes de la semana calendario que contiene `ymd` (Lima, lógica ISO: lunes = inicio). */
function mondayOfWeekContaining(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = dt.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDaysYmd(ymd, mondayOffset);
}

function firstOfMonthContaining(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Domingo de calendario más reciente con domingo ≤ ymd (Lima, fechas YMD). */
function lastSundayOnOrBefore(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = dt.getUTCDay();
  return addCalendarDaysYmd(ymd, -dow);
}

export function resolveVentasDateRangeYmd(
  preset: VentasReportPeriodPreset | undefined,
  referenceDate: Date = new Date(),
): { start: string; end: string; label: string } {
  const p = preset ?? "yesterday";
  const todayLima = ymdInLima(referenceDate);
  const yesterday = addCalendarDaysYmd(todayLima, -1);

  switch (p) {
    case "yesterday":
      return {
        start: yesterday,
        end: yesterday,
        label: "día anterior (Lima)",
      };
    case "last_7_days":
      return {
        start: addCalendarDaysYmd(yesterday, -6),
        end: yesterday,
        label: "últimos 7 días calendario hasta ayer (Lima)",
      };
    case "last_30_days":
      return {
        start: addCalendarDaysYmd(yesterday, -29),
        end: yesterday,
        label: "últimos 30 días calendario hasta ayer (Lima)",
      };
    case "last_complete_week": {
      const end = lastSundayOnOrBefore(yesterday);
      const start = addCalendarDaysYmd(end, -6);
      return {
        start,
        end,
        label: "última semana completa lun–dom (Lima)",
      };
    }
    case "this_week": {
      const start = mondayOfWeekContaining(yesterday);
      return {
        start,
        end: yesterday,
        label: "semana en curso (lun–mar… hasta ayer, Lima)",
      };
    }
    case "this_month":
      return {
        start: firstOfMonthContaining(yesterday),
        end: yesterday,
        label: "mes en curso (del 1 hasta ayer, Lima)",
      };
    default:
      return {
        start: yesterday,
        end: yesterday,
        label: "día anterior (Lima)",
      };
  }
}

/** Añade instrucción explícita de fechas al prompt (solo ventas). */
export function appendVentasPeriodToQuery(
  module: string,
  preset: VentasReportPeriodPreset | undefined,
  query: string,
  referenceDate?: Date,
): string {
  if (module !== "ventas") return query;

  const { start, end, label } = resolveVentasDateRangeYmd(preset, referenceDate);
  const d1 = formatDisplayDmy(start);
  const d2 = formatDisplayDmy(end);
  const isoMarker = ventasIsoRangeMarker(start, end);

  return `${query.trim()}

[PERIODO DE VENTAS — ${label}]
Usa exclusivamente ventas con fecha operativa entre **${d1}** y **${d2}** (inclusive, calendario DD/MM/YYYY), interpretadas en zona horaria **America/Lima**.
Si el texto de la pregunta menciona otro periodo (por ejemplo "ayer"), **prevalece este periodo**.
${isoMarker}`;
}

export const VENTAS_PERIOD_LABELS: Record<VentasReportPeriodPreset, string> = {
  yesterday: "Día anterior (ayer en Lima)",
  last_7_days: "Últimos 7 días (hasta ayer)",
  last_30_days: "Últimos 30 días (hasta ayer)",
  last_complete_week: "Última semana completa (lun–dom)",
  this_week: "Semana actual (lun → ayer)",
  this_month: "Mes actual (día 1 → ayer)",
};
