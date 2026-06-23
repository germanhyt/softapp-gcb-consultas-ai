import { NextResponse } from "next/server";
import type { VentasReportPeriodPreset } from "@/lib/scheduler/types";
import {
  getMaskedToteatWebhookConfig,
  getToteatWebhookDefaults,
  readToteatWebhookStoredConfig,
  writeToteatWebhookStoredConfig,
  type ToteatWebhookFormat,
  type ToteatWebhookStoredConfig,
} from "@/lib/config/toteat-webhook-config";
import { generateToteatScheduledReport } from "@/lib/toteat/report-generator";

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

function parseHour(value: unknown): number | null {
  if (value === null || value === "") return null;
  const h = Number(value);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  return h;
}

export async function GET() {
  try {
    return NextResponse.json(getMaskedToteatWebhookConfig());
  } catch (error) {
    console.error("[Settings ToteatWebhook] GET error:", error);
    return NextResponse.json({ error: "Error al leer webhook Toteat" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = readToteatWebhookStoredConfig();
    const maskedEffective = getMaskedToteatWebhookConfig().maskedSecret;

    const incomingSecret = String(body.secret ?? "").trim();
    const secretUnchanged =
      incomingSecret === "" ||
      /^[\u2022*]+$/u.test(incomingSecret) ||
      (maskedEffective !== "" && incomingSecret === maskedEffective);

    const enabled = typeof body.enabled === "boolean" ? body.enabled : current.enabled;

    let defaultPeriod = current.defaultPeriod;
    if (typeof body.defaultPeriod === "string" && PERIOD_PRESETS.has(body.defaultPeriod)) {
      defaultPeriod = body.defaultPeriod as VentasReportPeriodPreset;
    }

    const defaultRestaurantId =
      typeof body.defaultRestaurantId === "string"
        ? body.defaultRestaurantId.trim()
        : current.defaultRestaurantId;

    let defaultHourFrom = current.defaultHourFrom;
    if (body.defaultHourFrom !== undefined) {
      const parsed = parseHour(body.defaultHourFrom);
      if (body.defaultHourFrom !== null && parsed === null && body.defaultHourFrom !== "") {
        return NextResponse.json({ error: "defaultHourFrom inválido (0-23)" }, { status: 400 });
      }
      defaultHourFrom = parsed;
    }

    let defaultHourTo = current.defaultHourTo;
    if (body.defaultHourTo !== undefined) {
      const parsed = parseHour(body.defaultHourTo);
      if (body.defaultHourTo !== null && parsed === null && body.defaultHourTo !== "") {
        return NextResponse.json({ error: "defaultHourTo inválido (0-23)" }, { status: 400 });
      }
      defaultHourTo = parsed;
    }

    let defaultFormat = current.defaultFormat;
    if (typeof body.defaultFormat === "string" && FORMAT_VALUES.has(body.defaultFormat)) {
      defaultFormat = body.defaultFormat as ToteatWebhookFormat;
    }

    const next: ToteatWebhookStoredConfig = {
      enabled,
      secret: secretUnchanged ? current.secret : incomingSecret,
      defaultPeriod,
      defaultRestaurantId,
      defaultHourFrom,
      defaultHourTo,
      defaultFormat,
    };

    writeToteatWebhookStoredConfig(next);
    return NextResponse.json(getMaskedToteatWebhookConfig());
  } catch (error) {
    console.error("[Settings ToteatWebhook] POST error:", error);
    const message = error instanceof Error ? error.message : "Error al guardar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Prueba interna con los defaults guardados (no expone el secret). */
export async function PUT() {
  try {
    const defaults = getToteatWebhookDefaults();
    const report = await generateToteatScheduledReport({
      period: defaults.defaultPeriod,
      restaurantId: defaults.defaultRestaurantId || null,
      hourFrom: defaults.defaultHourFrom,
      hourTo: defaults.defaultHourTo,
    });
    return NextResponse.json({
      ok: true,
      period_label: report.periodLabel,
      start_date: report.startDate,
      end_date: report.endDate,
      preview: report.content.slice(0, 600) + (report.content.length > 600 ? "…" : ""),
    });
  } catch (error) {
    console.error("[Settings ToteatWebhook] PUT test error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error en prueba" },
      { status: 500 },
    );
  }
}
