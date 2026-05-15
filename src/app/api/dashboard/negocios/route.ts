import { NextResponse } from "next/server";
import { executeBigQuery, BQ_PROJECT } from "@/lib/data/bigquery-client";

export async function GET() {
  try {
    const sql = `
      SELECT DISTINCT COALESCE(n.Descripcion, s.CodigoNegocio) AS negocio
      FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
      LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
        ON s.CodigoNegocio = n.CodigoNegocio
      WHERE COALESCE(n.Descripcion, s.CodigoNegocio) IS NOT NULL
        AND TRIM(COALESCE(n.Descripcion, s.CodigoNegocio)) != ''
      ORDER BY negocio
    `;
    const result = await executeBigQuery(sql);
    const negocios = result.rows.map((r) => String(r.negocio).trim()).filter(Boolean);
    return NextResponse.json({ negocios });
  } catch (e) {
    console.error("[dashboard/negocios] Error:", e);
    return NextResponse.json({ negocios: [] });
  }
}
