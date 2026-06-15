import { NextResponse } from "next/server";
import { executeTaskNow } from "@/lib/scheduler/cron-manager";
import type { VentasReportPeriodPreset } from "@/lib/scheduler/types";

const VENTAS_PERIOD_PRESETS = new Set<string>([
  "yesterday",
  "yesterday_to_today",
  "last_7_days",
  "last_30_days",
  "last_complete_week",
  "this_week",
  "this_month",
]);

function parseRecipientsInput(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function parseOptionalHourInput(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const h = Number(raw);
  if (!Number.isInteger(h) || h < 0 || h > 23) return undefined;
  return h;
}

// POST - Execute a task immediately (optional email recipients override, optional skipEmail)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const taskId = body.taskId as string | undefined;
    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const recipients = parseRecipientsInput(body.recipients);
    const skipEmail = Boolean(body.skipEmail);

    let ventasReportPeriod: VentasReportPeriodPreset | undefined;
    if (
      body.ventasReportPeriod !== undefined &&
      body.ventasReportPeriod !== null &&
      String(body.ventasReportPeriod).trim() !== ""
    ) {
      const s = String(body.ventasReportPeriod);
      if (!VENTAS_PERIOD_PRESETS.has(s)) {
        return NextResponse.json({ error: "ventasReportPeriod no válido" }, { status: 400 });
      }
      ventasReportPeriod = s as VentasReportPeriodPreset;
    }

    const toteatHourFrom = parseOptionalHourInput(body.toteatHourFrom);
    const toteatHourTo = parseOptionalHourInput(body.toteatHourTo);
    if (body.toteatHourFrom !== undefined && toteatHourFrom === undefined) {
      return NextResponse.json({ error: "toteatHourFrom inválido (0-23)" }, { status: 400 });
    }
    if (body.toteatHourTo !== undefined && toteatHourTo === undefined) {
      return NextResponse.json({ error: "toteatHourTo inválido (0-23)" }, { status: 400 });
    }
    const toteatRestaurantId =
      body.toteatRestaurantId !== undefined && body.toteatRestaurantId !== null
        ? String(body.toteatRestaurantId).trim() || undefined
        : undefined;

    const result = await executeTaskNow(taskId, {
      recipients,
      skipEmail,
      ventasReportPeriod,
      toteatRestaurantId,
      toteatHourFrom,
      toteatHourTo,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
