import type { VentasReportPeriodPreset } from "@/lib/scheduler/types";
import type { ToteatWebhookFormat } from "@/lib/toteat/webhook-constants";
import { getToteatWebhookDefaults } from "@/lib/config/toteat-webhook-config";
import type { ToteatReportOptions } from "./report-generator";

const PERIOD_PRESETS = new Set<string>([
  "yesterday",
  "yesterday_to_today",
  "last_7_days",
  "last_30_days",
  "last_complete_week",
  "this_week",
  "this_month",
]);

const FORMAT_VALUES = new Set<string>(["json", "markdown", "csv", "full", "both"]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseHour(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const h = Number(value);
  if (!Number.isInteger(h) || h < 0 || h > 23) return undefined;
  return h;
}

function pickString(source: Record<string, unknown>, key: string): string | undefined {
  const v = source[key];
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export interface ParsedToteatWebhookParams {
  period?: VentasReportPeriodPreset;
  startDate?: string;
  endDate?: string;
  restaurantId?: string;
  hourFrom?: number | null;
  hourTo?: number | null;
  format: ToteatWebhookFormat;
}

export function parseToteatWebhookParams(
  searchParams: URLSearchParams,
  body?: Record<string, unknown>,
): { params: ParsedToteatWebhookParams; error?: string } {
  const defaults = getToteatWebhookDefaults();
  const source: Record<string, unknown> = { ...Object.fromEntries(searchParams.entries()) };
  if (body) Object.assign(source, body);

  let period: VentasReportPeriodPreset | undefined;
  const periodRaw = pickString(source, "period");
  if (periodRaw) {
    if (!PERIOD_PRESETS.has(periodRaw)) {
      return { params: { format: defaults.defaultFormat }, error: "period no válido" };
    }
    period = periodRaw as VentasReportPeriodPreset;
  }

  const startDate = pickString(source, "start_date");
  const endDate = pickString(source, "end_date");
  if (startDate && !DATE_RE.test(startDate)) {
    return { params: { format: defaults.defaultFormat }, error: "start_date inválido (YYYY-MM-DD)" };
  }
  if (endDate && !DATE_RE.test(endDate)) {
    return { params: { format: defaults.defaultFormat }, error: "end_date inválido (YYYY-MM-DD)" };
  }
  if (startDate && endDate && startDate > endDate) {
    return { params: { format: defaults.defaultFormat }, error: "Rango de fechas inválido" };
  }

  const restaurantId =
    (pickString(source, "restaurant") ??
      pickString(source, "restaurantId") ??
      pickString(source, "toteatRestaurantId")) ||
    defaults.defaultRestaurantId ||
    undefined;

  const hourFrom =
    parseHour(source.hour_from) ??
    parseHour(source.hourFrom) ??
    parseHour(source.toteatHourFrom) ??
    defaults.defaultHourFrom;
  const hourTo =
    parseHour(source.hour_to) ??
    parseHour(source.hourTo) ??
    parseHour(source.toteatHourTo) ??
    defaults.defaultHourTo;

  if (
    (source.hour_from !== undefined ||
      source.hourFrom !== undefined ||
      source.toteatHourFrom !== undefined) &&
    hourFrom === undefined
  ) {
    return { params: { format: defaults.defaultFormat }, error: "hour_from inválido (0-23)" };
  }
  if (
    (source.hour_to !== undefined ||
      source.hourTo !== undefined ||
      source.toteatHourTo !== undefined) &&
    hourTo === undefined
  ) {
    return { params: { format: defaults.defaultFormat }, error: "hour_to inválido (0-23)" };
  }

  const formatRaw = pickString(source, "format") ?? defaults.defaultFormat;
  if (!FORMAT_VALUES.has(formatRaw)) {
    return { params: { format: defaults.defaultFormat }, error: "format no válido" };
  }

  return {
    params: {
      period: period ?? (startDate && endDate ? undefined : defaults.defaultPeriod),
      startDate,
      endDate,
      restaurantId,
      hourFrom: hourFrom ?? null,
      hourTo: hourTo ?? null,
      format: formatRaw as ToteatWebhookFormat,
    },
  };
}

export function toReportOptions(parsed: ParsedToteatWebhookParams): ToteatReportOptions {
  if (parsed.startDate && parsed.endDate) {
    return {
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      restaurantId: parsed.restaurantId ?? null,
      hourFrom: parsed.hourFrom ?? null,
      hourTo: parsed.hourTo ?? null,
    };
  }
  return {
    period: parsed.period ?? "yesterday",
    restaurantId: parsed.restaurantId ?? null,
    hourFrom: parsed.hourFrom ?? null,
    hourTo: parsed.hourTo ?? null,
  };
}
