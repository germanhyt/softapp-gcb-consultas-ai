import { readFileSync } from "fs";
import { resolve } from "path";
import { BigQuery } from "@google-cloud/bigquery";

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
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON!);
  credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  const bq = new BigQuery({ projectId: "neat-chain-450900-a1", credentials });

  async function q(sql: string) {
    const [job] = await bq.createQueryJob({
      query: sql,
      location: "US",
      maximumBytesBilled: String(500 * 1024 * 1024),
    });
    const [rows] = await job.getQueryResults();
    return rows;
  }

  console.log(
    "Rango global:",
    JSON.stringify(
      await q(`
SELECT COUNT(*) AS c,
       COUNT(DISTINCT CodigoNegocio) AS negocios,
       CAST(MIN(Fecha) AS STRING) AS minf,
       CAST(MAX(Fecha) AS STRING) AS maxf
FROM \`neat-chain-450900-a1.Ventas.Pronostico\``),
      null,
      2
    )
  );

  console.log(
    "Sample reciente:",
    JSON.stringify(
      await q(`
SELECT CAST(Fecha AS STRING) AS Fecha, CodigoNegocio,
       Predicted_Ventas, Predicted_Ventas_Locatario, EsFeriado
FROM \`neat-chain-450900-a1.Ventas.Pronostico\`
ORDER BY Fecha DESC
LIMIT 8`),
      null,
      2
    )
  );

  console.log(
    "Meses con datos:",
    JSON.stringify(
      await q(`
SELECT FORMAT_DATETIME('%Y-%m', Fecha) AS ym, COUNT(*) AS c,
       COUNT(DISTINCT CodigoNegocio) AS negocios
FROM \`neat-chain-450900-a1.Ventas.Pronostico\`
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12`),
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
