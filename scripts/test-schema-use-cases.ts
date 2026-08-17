/**
 * Verifica casos de uso del asistente tras el refuerzo semántico de schemas.
 * Uso: npx tsx --env-file=.env.local scripts/test-schema-use-cases.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { detectModule } from "../src/lib/ai/context-builder";
import { generateSQL } from "../src/lib/ai/sql-generator";
import { executeBigQuery } from "../src/lib/data/bigquery-client";

function loadEnvLocal() {
  if (process.env.GOOGLE_CREDENTIALS_JSON && process.env.GOOGLE_GENERATIVE_AI_API_KEY) return;
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

type BQModule = "ventas" | "estacionamiento" | "flujo";

interface Case {
  id: string;
  question: string;
  expectModule: BQModule;
  /** Todos deben aparecer en el SQL (case-insensitive). */
  mustInclude: string[];
  /** Si alguno aparece, falla. */
  mustNotInclude?: string[];
  execute?: boolean;
}

const CASES: Case[] = [
  {
    id: "1-locatario",
    question: "¿Cuánto vendió cada locatario este mes? Incluye el nombre del negocio.",
    expectModule: "ventas",
    mustInclude: ["sales_df", "Negocios"],
  },
  {
    id: "2-categoria",
    question: "Ventas por categoría de producto este mes",
    expectModule: "ventas",
    mustInclude: ["sales_df", "Categorias"],
  },
  {
    id: "3-meta-global",
    question: "Compara la meta del establecimiento completo versus la venta real de este mes",
    expectModule: "ventas",
    mustInclude: ["MontosMeta", "sales_df"],
  },
  {
    id: "4-meta-locatario",
    question:
      "Suma MontoMeta de MontosMetaMicro por locatario (TipoNegocio o Negocios.Descripcion) del mes actual",
    expectModule: "ventas",
    mustInclude: ["MontosMetaMicro"],
  },
  {
    id: "5-prediccion-cierre",
    question:
      "Según Predicciones, ¿qué ventas se proyectan para las fechas restantes hasta el cierre de mes? Usa VentasProyectadas (tabla a nivel establecimiento, sin CodigoNegocio).",
    expectModule: "ventas",
    mustInclude: ["Predicciones", "VentasProyectadas"],
    mustNotInclude: ["MontosMeta", "CodigoNegocio"],
  },
  {
    id: "6-evento",
    question: "¿Cuánto se ingresó por eventos este mes? Usa TipoIngreso EVENTO",
    expectModule: "ventas",
    mustInclude: ["sales_df", "TipoIngreso", "EVENTO"],
  },
  {
    id: "7-flujo-zonas",
    question: "Afluencia de personas por zona esta semana",
    expectModule: "flujo",
    mustInclude: ["Personas_por_zonas"],
  },
  {
    id: "8-flujo-puertas",
    question: "Total de entradas por puerta y hora ayer",
    expectModule: "flujo",
    mustInclude: ["Total_Puertas_Hora"],
  },
  {
    id: "9-estacionamiento",
    question: "Movimientos de estacionamiento por lugar (nombre y capacidad) esta semana",
    expectModule: "estacionamiento",
    mustInclude: ["Registro", "Lugares"],
  },
];

function includesAll(sql: string, needles: string[]): string[] {
  const upper = sql.toUpperCase();
  return needles.filter((n) => !upper.includes(n.toUpperCase()));
}

function includesAny(sql: string, needles: string[]): string[] {
  const upper = sql.toUpperCase();
  return needles.filter((n) => upper.includes(n.toUpperCase()));
}

async function runCase(c: Case) {
  const module = detectModule(c.question);
  const routingOk = module === c.expectModule;

  let sql = "";
  let sqlError = "";
  let bqOk: boolean | null = null;
  let bqError = "";
  let rowCount = 0;

  if (routingOk) {
    let gen = await generateSQL(c.question, c.expectModule);
    sql = gen.sql || "";
    sqlError = gen.error || "";
    if (!sql && sqlError) {
      gen = await generateSQL(
        c.question,
        c.expectModule,
        undefined,
        `Generación previa inválida: ${sqlError}. Genera un SELECT más compacto y completo.`
      );
      sql = gen.sql || "";
      sqlError = gen.error || "";
    }
  }

  const missing = sql ? includesAll(sql, c.mustInclude) : [...c.mustInclude];
  const forbidden = sql && c.mustNotInclude ? includesAny(sql, c.mustNotInclude) : [];

  if (sql && missing.length === 0 && forbidden.length === 0) {
    try {
      const result = await executeBigQuery(sql);
      bqOk = true;
      rowCount = result.rowCount;
    } catch (e) {
      bqOk = false;
      bqError = e instanceof Error ? e.message : String(e);

      // Un reintento con el error de BQ (igual que el chat)
      const retry = await generateSQL(c.question, c.expectModule, undefined, bqError);
      if (retry.sql) {
        const missing2 = includesAll(retry.sql, c.mustInclude);
        const forbidden2 = c.mustNotInclude ? includesAny(retry.sql, c.mustNotInclude) : [];
        if (missing2.length === 0 && forbidden2.length === 0) {
          try {
            const result2 = await executeBigQuery(retry.sql);
            sql = retry.sql;
            bqOk = true;
            bqError = "";
            rowCount = result2.rowCount;
          } catch (e2) {
            sql = retry.sql;
            bqOk = false;
            bqError = e2 instanceof Error ? e2.message : String(e2);
          }
        } else {
          sql = retry.sql;
        }
      }
    }
  }

  const pass =
    routingOk &&
    !sqlError &&
    Boolean(sql) &&
    missing.length === 0 &&
    forbidden.length === 0 &&
    bqOk === true;

  return {
    id: c.id,
    question: c.question,
    pass,
    routingOk,
    module,
    expectModule: c.expectModule,
    sqlError,
    missing,
    forbidden,
    bqOk,
    bqError: bqError.slice(0, 240),
    rowCount,
    sql: sql.slice(0, 500),
  };
}

async function main() {
  loadEnvLocal();

  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    console.error("Falta GOOGLE_CREDENTIALS_JSON");
    process.exit(1);
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("Falta GOOGLE_GENERATIVE_AI_API_KEY");
    process.exit(1);
  }

  console.log("=== Test casos de uso schema asistente ===\n");

  const results = [];
  for (const c of CASES) {
    process.stdout.write(`→ ${c.id} ... `);
    const r = await runCase(c);
    results.push(r);
    console.log(r.pass ? "PASS" : "FAIL");
    if (!r.pass) {
      console.log(
        JSON.stringify(
          {
            module: r.module,
            expect: r.expectModule,
            routingOk: r.routingOk,
            sqlError: r.sqlError,
            missing: r.missing,
            forbidden: r.forbidden,
            bqOk: r.bqOk,
            bqError: r.bqError,
            sql: r.sql,
          },
          null,
          2
        )
      );
    } else {
      console.log(`   rows=${r.rowCount}`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== Resumen: ${passed}/${results.length} PASS ===`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
