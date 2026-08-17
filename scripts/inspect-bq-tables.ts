import { readFileSync } from "fs";
import { resolve } from "path";
import { executeBigQuery } from "../src/lib/data/bigquery-client";

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

async function main() {
  loadEnvLocal();

  const cols = await executeBigQuery(
    `SELECT column_name, data_type
     FROM \`neat-chain-450900-a1.Ventas.INFORMATION_SCHEMA.COLUMNS\`
     WHERE table_name = 'sales_df'
     ORDER BY ordinal_position`
  );
  console.log("sales_df cols:", cols.rows.map((x) => `${x.column_name}:${x.data_type}`).join(", "));

  const tipos = await executeBigQuery(
    `SELECT TipoIngreso, COUNT(*) AS n
     FROM \`neat-chain-450900-a1.Ventas.sales_df\`
     WHERE TipoIngreso IS NOT NULL
     GROUP BY TipoIngreso
     ORDER BY n DESC
     LIMIT 20`
  );
  console.log("TipoIngreso:", JSON.stringify(tipos.rows, null, 2));

  const pred = await executeBigQuery(
    `SELECT
       COUNT(*) AS total,
       COUNTIF(Fecha > CURRENT_DATE('America/Lima')) AS futuras,
       COUNTIF(VentasProyectadas > 0) AS con_proyeccion,
       SUM(Ventas) AS sum_ventas,
       SUM(VentasProyectadas) AS sum_proy
     FROM \`neat-chain-450900-a1.Ventas.Predicciones\`
     WHERE Anio = EXTRACT(YEAR FROM CURRENT_DATE('America/Lima'))
       AND Mes = EXTRACT(MONTH FROM CURRENT_DATE('America/Lima'))`
  );
  console.log("Predicciones mes actual:", JSON.stringify(pred.rows, null, 2));

  const micro = await executeBigQuery(
    `SELECT
       COUNT(*) AS n,
       COUNTIF(CodigoNegocio IS NOT NULL) AS con_codigo,
       COUNT(DISTINCT TipoNegocio) AS tipos
     FROM \`neat-chain-450900-a1.Ventas.MontosMetaMicro\`
     WHERE Anio = EXTRACT(YEAR FROM CURRENT_DATE('America/Lima'))
       AND Mes = FORMAT_DATE('%B', CURRENT_DATE('America/Lima'))`
  );
  console.log("MontosMetaMicro mes:", JSON.stringify(micro.rows, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
