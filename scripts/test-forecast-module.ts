/**
 * Verifica el módulo de pronóstico propio (ventas-forecast.ts) y el contexto
 * completo que recibirá el asistente.
 *
 * Uso: npx tsx scripts/test-forecast-module.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  calcularPronosticoMensual,
  formatPronosticoParaIA,
  fechaEspecial,
} from "../src/lib/data/ventas-forecast";

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  console.log("=== Fechas especiales ===");
  for (const f of ["2026-08-30", "2026-10-31", "2026-05-10", "2026-08-15"]) {
    console.log(`  ${f} → ${fechaEspecial(f) ?? "(normal)"}`);
  }

  console.log("\n=== Pronóstico agosto 2026 ===\n");
  const p = await calcularPronosticoMensual(2026, 8);
  if (!p) {
    console.error("Sin datos");
    process.exit(1);
  }
  console.log(formatPronosticoParaIA(p));

  console.log("\n=== Validaciones ===");
  const checks: Array<[string, boolean]> = [
    ["última fecha con datos presente", Boolean(p.ultimaFechaConDatos)],
    ["venta real > 0", p.ventaRealAcumulada > 0],
    ["proyección > 0", p.proyeccionRestante > 0],
    [
      "total = real + proyectado",
      Math.abs(p.totalEstimado - (p.ventaRealAcumulada + p.proyeccionRestante)) < 1,
    ],
    ["P25 < total < P75", p.totalP25 < p.totalEstimado && p.totalEstimado < p.totalP75],
    ["cubre todos los días restantes", p.diasConVentaReal + p.diasProyectados === 31],
    [
      "promedio proyectado coherente con el real (±35%)",
      Math.abs(p.promedioDiarioProyectado - p.promedioDiarioReal) / p.promedioDiarioReal < 0.35,
    ],
    ["Santa Rosa (30-ago) detectada", p.detalle.some((d) => d.fechaEspecial === "Santa Rosa")],
  ];

  let ok = 0;
  for (const [name, pass] of checks) {
    if (pass) ok++;
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  }

  // Comparación contra el pronóstico oficial
  const { executeBigQuery } = await import("../src/lib/data/bigquery-client");
  const oficial = await executeBigQuery(
    `SELECT ROUND(SUM(Ventas) + SUM(VentasProyectadas), 2) AS total
     FROM \`neat-chain-450900-a1.Ventas.Predicciones\`
     WHERE Anio = 2026 AND Mes = 8`
  );
  const totalOficial = Number(oficial.rows[0]?.total ?? 0);
  console.log(
    `\nOficial: ${totalOficial.toLocaleString("es-PE")} | Recalculado: ${p.totalEstimado.toLocaleString(
      "es-PE"
    )} | Diferencia: ${(((p.totalEstimado - totalOficial) / totalOficial) * 100).toFixed(1)}%`
  );

  console.log(`\n=== Resumen: ${ok}/${checks.length} ===`);
  process.exit(ok === checks.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
