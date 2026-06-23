import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import type { VentasReportPeriodPreset } from "@/lib/scheduler/types";
import {
  TOTEAT_WEBHOOK_PATH,
  type ToteatWebhookFormat,
} from "@/lib/toteat/webhook-constants";

export type { ToteatWebhookFormat } from "@/lib/toteat/webhook-constants";
export { TOTEAT_WEBHOOK_PATH } from "@/lib/toteat/webhook-constants";

export interface ToteatWebhookStoredConfig {
  enabled: boolean;
  secret: string;
  defaultPeriod: VentasReportPeriodPreset;
  defaultRestaurantId: string;
  defaultHourFrom: number | null;
  defaultHourTo: number | null;
  defaultFormat: ToteatWebhookFormat;
}

export interface MaskedToteatWebhookConfig {
  enabled: boolean;
  hasSecret: boolean;
  maskedSecret: string;
  ready: boolean;
  defaultPeriod: VentasReportPeriodPreset;
  defaultRestaurantId: string;
  defaultHourFrom: number | null;
  defaultHourTo: number | null;
  defaultFormat: ToteatWebhookFormat;
  webhookPath: string;
}

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

function findProjectRootFromCwd(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    const hasPackageJson = existsSync(join(currentDir, "package.json"));
    const hasSrcDir = existsSync(join(currentDir, "src"));
    if (hasPackageJson && hasSrcDir) return currentDir;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return startDir;
    currentDir = parentDir;
  }
}

const PROJECT_ROOT = findProjectRootFromCwd(process.cwd());
const CONFIG_DIR = join(PROJECT_ROOT, "data");
const CONFIG_PATH = join(CONFIG_DIR, "toteat-webhook-config.json");

const DEFAULT_STORED: ToteatWebhookStoredConfig = {
  enabled: false,
  secret: "",
  defaultPeriod: "yesterday",
  defaultRestaurantId: "",
  defaultHourFrom: null,
  defaultHourTo: null,
  defaultFormat: "both",
};

export function maskWebhookSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 4) return "••••";
  return "••••••••" + secret.slice(-4);
}

function parseHour(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const h = Number(value);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  return h;
}

function parseStored(raw: unknown): ToteatWebhookStoredConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STORED };
  const o = raw as Record<string, unknown>;
  const enabled = typeof o.enabled === "boolean" ? o.enabled : DEFAULT_STORED.enabled;
  const secret = typeof o.secret === "string" ? o.secret : "";
  const periodRaw = typeof o.defaultPeriod === "string" ? o.defaultPeriod : DEFAULT_STORED.defaultPeriod;
  const defaultPeriod = PERIOD_PRESETS.has(periodRaw)
    ? (periodRaw as VentasReportPeriodPreset)
    : DEFAULT_STORED.defaultPeriod;
  const defaultRestaurantId =
    typeof o.defaultRestaurantId === "string" ? o.defaultRestaurantId.trim() : "";
  const defaultHourFrom = parseHour(o.defaultHourFrom);
  const defaultHourTo = parseHour(o.defaultHourTo);
  const formatRaw =
    typeof o.defaultFormat === "string" ? o.defaultFormat : DEFAULT_STORED.defaultFormat;
  const defaultFormat = FORMAT_VALUES.has(formatRaw)
    ? (formatRaw as ToteatWebhookFormat)
    : DEFAULT_STORED.defaultFormat;

  return {
    enabled,
    secret,
    defaultPeriod,
    defaultRestaurantId,
    defaultHourFrom,
    defaultHourTo,
    defaultFormat,
  };
}

export function readToteatWebhookStoredConfig(): ToteatWebhookStoredConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return parseStored(raw);
    }
  } catch (err) {
    console.error("[ToteatWebhookConfig] read error:", err);
  }
  return { ...DEFAULT_STORED };
}

export function writeToteatWebhookStoredConfig(config: ToteatWebhookStoredConfig): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[ToteatWebhookConfig] write error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`No se pudo guardar webhook Toteat (${detail}). Ruta: ${CONFIG_PATH}`);
  }
}

function effectiveSecret(stored: ToteatWebhookStoredConfig): string {
  const fromEnv = (process.env.TOTEAT_WEBHOOK_SECRET ?? "").trim();
  if (fromEnv) return fromEnv;
  return (stored.secret ?? "").trim();
}

function effectiveEnabled(stored: ToteatWebhookStoredConfig): boolean {
  const envFlag = (process.env.TOTEAT_WEBHOOK_ENABLED ?? "").trim().toLowerCase();
  if (envFlag === "true" || envFlag === "1") return true;
  if (envFlag === "false" || envFlag === "0") return false;
  return stored.enabled;
}

export function getToteatWebhookEffectiveSecret(): string {
  return effectiveSecret(readToteatWebhookStoredConfig());
}

export function isToteatWebhookEnabled(): boolean {
  const stored = readToteatWebhookStoredConfig();
  return effectiveEnabled(stored) && Boolean(getToteatWebhookEffectiveSecret());
}

export function getMaskedToteatWebhookConfig(): MaskedToteatWebhookConfig {
  const stored = readToteatWebhookStoredConfig();
  const secret = effectiveSecret(stored);
  const enabled = effectiveEnabled(stored);

  return {
    enabled,
    hasSecret: Boolean(secret),
    maskedSecret: maskWebhookSecret(secret),
    ready: enabled && Boolean(secret),
    defaultPeriod: stored.defaultPeriod,
    defaultRestaurantId: stored.defaultRestaurantId,
    defaultHourFrom: stored.defaultHourFrom,
    defaultHourTo: stored.defaultHourTo,
    defaultFormat: stored.defaultFormat,
    webhookPath: TOTEAT_WEBHOOK_PATH,
  };
}

export function getToteatWebhookDefaults(): Pick<
  ToteatWebhookStoredConfig,
  "defaultPeriod" | "defaultRestaurantId" | "defaultHourFrom" | "defaultHourTo" | "defaultFormat"
> {
  const stored = readToteatWebhookStoredConfig();
  return {
    defaultPeriod: stored.defaultPeriod,
    defaultRestaurantId: stored.defaultRestaurantId,
    defaultHourFrom: stored.defaultHourFrom,
    defaultHourTo: stored.defaultHourTo,
    defaultFormat: stored.defaultFormat,
  };
}
