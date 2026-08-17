import { readFileSync } from "fs";
import { resolve } from "path";
import { parsePronosticoMensual } from "../src/lib/data/ventas-pronostico-mensual-sql";
import {
  calcularPronosticoPorLocatario,
  formatPronosticoLocatarioParaIA,
} from "../src/lib/data/ventas-forecast";

function loadEnvLocal() {
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
}

const NOW = new Date(2026, 7, 11);

async function main() {
  loadEnvLocal();

  const cases = [
    {
      q: "pronóstico de agosto por locatario",
      expect: { scope: "todos_locatarios" },
    },
    {
      q: "dame el pronóstico de Sisa para agosto",
      expect: { scope: "locatario", locatarioHint: "SISA" },
    },
    {
      q: "proyección de ventas del mes",
      expect: { scope: "establecimiento" },
    },
  ];

  console.log("=== parse ===");
  for (const c of cases) {
    const got = parsePronosticoMensual(c.q, NOW);
    const ok =
      got?.scope === c.expect.scope &&
      (!("locatarioHint" in c.expect) || got?.locatarioHint === c.expect.locatarioHint);
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.q} → ${JSON.stringify(got)}`);
  }

  console.log("\n=== Sisa agosto ===\n");
  const sisa = await calcularPronosticoPorLocatario(2026, 8, "SISA");
  if (!sisa || !sisa.filas.length) {
    console.error("FAIL sin datos Sisa");
    process.exit(1);
  }
  console.log(formatPronosticoLocatarioParaIA(sisa));

  console.log("\n=== ranking top 5 ===\n");
  const all = await calcularPronosticoPorLocatario(2026, 8);
  if (!all || all.filas.length < 3) {
    console.error("FAIL ranking");
    process.exit(1);
  }
  console.log(
    all.filas
      .slice(0, 5)
      .map((f) => `${f.locatario}: ${f.totalEstimado}`)
      .join("\n")
  );
  console.log(`\nOK: ${all.filas.length} locatarios, corte ${all.ultimaFechaConDatos}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
