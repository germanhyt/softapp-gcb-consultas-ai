/**
 * Verifica la ruta determinística de pronóstico mensual del asistente:
 * detección de intención + SQL canónico + ejecución en BigQuery.
 *
 * Uso: npx tsx scripts/test-pronostico.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { detectModule } from "../src/lib/ai/context-builder";
import {
  buildPronosticoMensualSql,
  parsePronosticoMensual,
} from "../src/lib/data/ventas-pronostico-mensual-sql";
import { executeBigQuery, formatQueryResult } from "../src/lib/data/bigquery-client";

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

const NOW = new Date(2026, 7, 11); // 11 de agosto de 2026

const INTENT_CASES: Array<{
  q: string;
  expect: { anio: number; mes: number; scope?: string } | null;
}> = [
  { q: "dame el pronóstico de agosto", expect: { anio: 2026, mes: 8, scope: "establecimiento" } },
  { q: "¿cuál es la proyección de ventas de este mes?", expect: { anio: 2026, mes: 8 } },
  { q: "¿cuánto vamos a vender al cierre de mes?", expect: { anio: 2026, mes: 8 } },
  { q: "pronóstico de julio 2026", expect: { anio: 2026, mes: 7 } },
  { q: "proyección de ventas para diciembre", expect: { anio: 2025, mes: 12 } },
  { q: "forecast de ventas del mes", expect: { anio: 2026, mes: 8 } },
  { q: "¿cuánto se vendió ayer?", expect: null },
  { q: "ventas por locatario de agosto", expect: null },
  { q: "¿cuál es la meta de agosto?", expect: null },
];

async function main() {
  loadEnvLocal();

  console.log("=== 1. Detección de intención de pronóstico ===\n");
  let intentOk = 0;
  for (const c of INTENT_CASES) {
    const got = parsePronosticoMensual(c.q, NOW);
    const ok =
      c.expect === null
        ? got === null
        : !!got &&
          got.anio === c.expect.anio &&
          got.mes === c.expect.mes &&
          (!c.expect.scope || got.scope === c.expect.scope);
    if (ok) intentOk++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  "${c.q}" → ${JSON.stringify(got)} (esperado ${JSON.stringify(
        c.expect
      )})`
    );
  }
  console.log(`\nIntención: ${intentOk}/${INTENT_CASES.length}\n`);

  console.log("=== 2. Enrutamiento a módulo ventas ===\n");
  let routeOk = 0;
  const routeCases = INTENT_CASES.filter((c) => c.expect !== null);
  for (const c of routeCases) {
    const m = detectModule(c.q);
    const ok = m === "ventas";
    if (ok) routeOk++;
    console.log(`${ok ? "PASS" : "FAIL"}  "${c.q}" → ${m}`);
  }
  console.log(`\nEnrutamiento: ${routeOk}/${routeCases.length}\n`);

  console.log("=== 3. Ejecución del SQL canónico (agosto 2026) ===\n");
  const sql = buildPronosticoMensualSql(2026, 8);
  const result = await executeBigQuery(sql);
  console.log(formatQueryResult(result));

  const row = result.rows[0] as Record<string, unknown>;
  const val = (k: string) => {
    const v = row[k];
    if (v && typeof v === "object" && "value" in v) return String((v as { value: unknown }).value);
    return v;
  };

  console.log("\n=== 4. Validación de coherencia ===\n");
  const real = Number(val("venta_real_acumulada"));
  const proy = Number(val("venta_proyectada_restante"));
  const total = Number(val("venta_total_estimada_mes"));
  const checks: Array<[string, boolean]> = [
    ["expone última fecha con datos", Boolean(val("ultima_fecha_con_datos"))],
    ["venta real > 0", real > 0],
    ["proyección > 0", proy > 0],
    ["total = real + proyectado", Math.abs(total - (real + proy)) < 1],
    ["días proyectados > 0", Number(val("dias_proyectados")) > 0],
    ["% avance entre 0 y 100", Number(val("pct_avance_real")) > 0 && Number(val("pct_avance_real")) < 100],
  ];
  let ok = 0;
  for (const [name, pass] of checks) {
    if (pass) ok++;
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  }

  const totalOk = intentOk === INTENT_CASES.length && routeOk === routeCases.length && ok === checks.length;
  console.log(`\n=== Resumen: ${totalOk ? "TODO OK" : "HAY FALLOS"} ===`);
  process.exit(totalOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
