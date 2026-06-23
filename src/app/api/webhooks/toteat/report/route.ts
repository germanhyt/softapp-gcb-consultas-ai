import { NextRequest, NextResponse } from "next/server";
import { generateToteatScheduledReport } from "@/lib/toteat/report-generator";
import { validateToteatWebhookRequest } from "@/lib/toteat/webhook-auth";
import { parseToteatWebhookParams, toReportOptions } from "@/lib/toteat/webhook-params";
import { buildToteatWebhookSummary } from "@/lib/toteat/webhook-response";
import type { ToteatWebhookFormat } from "@/lib/toteat/webhook-constants";
import { getToteatSalesReportLabel } from "@/lib/toteat/source-context";

async function handleWebhook(req: NextRequest, body?: Record<string, unknown>) {
  const url = req.nextUrl;
  const auth = validateToteatWebhookRequest(req, url);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const parsed = parseToteatWebhookParams(url.searchParams, body);
  if (parsed.error) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const report = await generateToteatScheduledReport(toReportOptions(parsed.params));
    const format: ToteatWebhookFormat = parsed.params.format;
    const summary = buildToteatWebhookSummary(report.data);

    const meta = {
      source: getToteatSalesReportLabel(),
      period_label: report.periodLabel,
      start_date: report.startDate,
      end_date: report.endDate,
      csv_filename: report.csvFilename,
      generated_at: new Date().toISOString(),
    };

    if (format === "markdown") {
      return NextResponse.json({
        ok: true,
        format,
        meta,
        markdown: report.content,
      });
    }

    if (format === "csv") {
      return NextResponse.json({
        ok: true,
        format,
        meta,
        csv: report.csv,
      });
    }

    if (format === "full") {
      return NextResponse.json({
        ok: true,
        format,
        meta,
        data: report.data,
        markdown: report.content,
        csv: report.csv,
      });
    }

    if (format === "json") {
      return NextResponse.json({
        ok: true,
        format,
        meta,
        summary,
      });
    }

    return NextResponse.json({
      ok: true,
      format: "both",
      meta,
      summary,
      markdown: report.content,
      csv: report.csv,
    });
  } catch (e) {
    console.error("[webhooks/toteat/report] Error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handleWebhook(req);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | undefined;
  try {
    const json = await req.json();
    if (json && typeof json === "object") body = json as Record<string, unknown>;
  } catch {
    body = undefined;
  }
  return handleWebhook(req, body);
}
