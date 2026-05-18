import { NextResponse } from "next/server";
import { executeTaskNow } from "@/lib/scheduler/cron-manager";
import type { VentasReportPeriodPreset } from "@/lib/scheduler/types";

const VENTAS_PERIOD_PRESETS = new Set<string>([
  "yesterday",
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

    const result = await executeTaskNow(taskId, {
      recipients,
      skipEmail,
      ventasReportPeriod,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
