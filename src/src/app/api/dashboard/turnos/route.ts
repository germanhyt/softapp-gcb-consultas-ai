import { NextResponse } from "next/server";
import { executeBigQuery, BQ_PROJECT } from "@/lib/data/bigquery-client";

export async function GET() {
  try {
    const sql = `
      SELECT DISTINCT Turno
      FROM \`${BQ_PROJECT}.Ventas.sales_df\`
      WHERE Turno IS NOT NULL AND TRIM(COALESCE(Turno, '')) != ''
      ORDER BY Turno
    `;
    const result = await executeBigQuery(sql);
    const turnos = result.rows
      .map((r) => String(r.Turno).trim())
      .filter(Boolean);
    return NextResponse.json({ turnos });
  } catch (e) {
    console.error("[dashboard/turnos] Error:", e);
    return NextResponse.json({ turnos: [] });
  }
}
