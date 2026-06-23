import { generateText } from "ai";
import { getModel } from "./providers";
import { DEFAULT_MODEL_ID } from "./models";
import { BQ_PROJECT, getSchemaText } from "@/lib/data/bigquery-client";

type BQModule = "ventas" | "estacionamiento" | "flujo";

const MODULE_HINTS: Record<BQModule, string> = {
  ventas: `
- Usa SIEMPRE \`${BQ_PROJECT}.Ventas.sales_df\` como tabla principal de ventas.
- Para JOIN con negocios: \`${BQ_PROJECT}.Ventas.Negocios\` usando CodigoNegocio.
- Para categorías: \`${BQ_PROJECT}.Ventas.Categorias\` usando Producto.
- Fecha en sales_df es STRING con formato 'YYYY-MM-DD' (solo fecha, sin hora).
- Hora en sales_df es STRING con formato 'HH:MM:SS' (24 horas). Ejemplo: '08:30:15', '13:45:00', '23:59:59'.
- SIEMPRE usa LEFT(Fecha, 10) para comparar fechas: LEFT(Fecha, 10) = 'YYYY-MM-DD'
- Para ventas de hoy: LEFT(Fecha, 10) = FORMAT_DATE('%Y-%m-%d', CURRENT_DATE('America/Lima'))
- Para ventas de ayer: LEFT(Fecha, 10) = FORMAT_DATE('%Y-%m-%d', DATE_SUB(CURRENT_DATE('America/Lima'), INTERVAL 1 DAY))
- Para ventas de un mes: LEFT(Fecha, 7) = 'YYYY-MM'
- Si el texto incluye [VENTAS_RANGO_ISO:YYYY-MM-DD..YYYY-MM-DD], filtra con SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10) >= 'inicio' AND SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10) <= 'fin' (inclusive). Equivale al dashboard. No sustituyas por "ayer" ni CURRENT_DATE si ese marcador está presente.
- NUNCA uses PARSE_DATE ni CAST(Fecha AS DATE) directamente, siempre LEFT(Fecha, 10).
- Para filtrar por HORA usa LEFT(Hora, 2) o la columna Hora directamente con comparación de strings:
  Ejemplo: Hora >= '08:00:00' AND Hora < '12:00:00' (ventas entre 8am y mediodía)
  Ejemplo: Hora >= '12:00:00' AND Hora < '23:59:59' (ventas entre mediodía y medianoche)
  NOTA: Cuando el usuario dice "12 am" se refiere a medianoche (00:00), "12 pm" se refiere a mediodía (12:00).
  Para rangos nocturnos que cruzan medianoche (ej: 8pm a 2am), usa OR: (Hora >= '20:00:00' OR Hora < '02:00:00')
- Turno puede ser 'Mañana' o 'Noche'. Cuando el usuario diga "turno mañana" o "turno noche" filtra por esta columna.
- Monto es la columna de importe. Cantidad es unidades vendidas.
- No existe una sola columna "medio de pago"; para desglose por canal/medio usa CASE sobre Cliente y Producto (Rappi, PedidosYa, UberEats, Fidelio, Pago Link, Eventos, Salón presencial, etc.), coherente con análisis de canales de venta.
- Para presupuesto vs real: JOIN \`${BQ_PROJECT}.Ventas.Presupuesto\` por CodigoNegocio y mes.
- Metas globales: \`${BQ_PROJECT}.Ventas.MontosMeta\`. Pronósticos: \`${BQ_PROJECT}.Ventas.Pronostico\`, \`${BQ_PROJECT}.Ventas.Predicciones\`.
- IMPORTANTE: Cuando el usuario mencione "bar", "el bar", "del bar" se refiere al negocio "BAR REFUGIO". SIEMPRE filtra con: UPPER(COALESCE(n.Descripcion, '')) LIKE '%BAR%'
- Para ventas por negocio: agrupar por CodigoNegocio y hacer JOIN con Negocios.Descripcion.
- Si el usuario pide ventas de un negocio específico, SIEMPRE haz JOIN con Negocios y filtra por Descripcion.
- EJEMPLO completo de consulta por rango horario y negocio:
  SELECT
    CASE WHEN Hora >= '08:00:00' AND Hora < '12:00:00' THEN 'Mañana' ELSE 'Tarde' END AS franja,
    ROUND(SUM(Monto), 2) AS total_ventas
  FROM \`${BQ_PROJECT}.Ventas.sales_df\`
  LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n ON sales_df.CodigoNegocio = n.CodigoNegocio
  WHERE LEFT(Fecha, 10) >= '2026-03-01'
    AND UPPER(COALESCE(n.Descripcion, '')) LIKE '%BAR REFUGIO%'
  GROUP BY franja
  LIMIT 200
`,
  estacionamiento: `
- Tabla principal de movimientos: \`${BQ_PROJECT}.Estacionamiento.Registro\`
- tipo_camara = 'entrada' para entradas, 'salida' para salidas.
- JOIN con Lugares por codigo_lugar para nombre de zona.
- Vehículos únicos: \`${BQ_PROJECT}.Estacionamiento.Vehiculos\`
- Tarifas: \`${BQ_PROJECT}.Estacionamiento.Tarifas_horarias\`, \`${BQ_PROJECT}.Estacionamiento.Tarifas_excepcionales\`
- Visitantes/proveedores: \`${BQ_PROJECT}.Estacionamiento.Visitantes_proveedores\`
- Para contar vehículos únicos en un período: COUNT(DISTINCT placa) en Registro.
- Fecha es tipo DATE, hora es tipo TIME.
`,
  flujo: `
- Para flujo por zona: \`${BQ_PROJECT}.flujo_de_personas.Personas_por_zonas\`
- Para entradas/salidas por puerta: \`${BQ_PROJECT}.flujo_de_personas.Total_Puertas_Hora\`
- Fecha es tipo DATE, Hora es tipo TIME.
- dia_semana: 'Lunes', 'Martes', etc.
- Para total de visitantes: SUM(Personas) o SUM(Entradas).
`,
};

const SYSTEM_SQL = `Eres un experto en BigQuery SQL. Tu única tarea es generar una consulta SQL válida para BigQuery.

REGLAS CRÍTICAS:
1. Responde ÚNICAMENTE con el SQL, sin explicaciones, sin markdown, sin bloques de código.
2. El SQL debe ser una sola SELECT (no INSERT, UPDATE, DELETE).
3. Usa siempre el project ID completo: \`${BQ_PROJECT}.dataset.tabla\`
4. Limita resultados a máximo 200 filas con LIMIT.
5. Si la pregunta es ambigua, usa el período de los últimos 30 días como default.
6. Para fechas relativas usa CURRENT_DATE('America/Lima').
7. No uses funciones que no existen en BigQuery estándar.
8. Agrega ORDER BY cuando sea útil para el análisis.
9. Si usas alias para tablas (AS s, AS n), úsalos CONSISTENTEMENTE en TODAS las referencias de columnas incluyendo WHERE, GROUP BY, ORDER BY.
10. Cuando solo hay una tabla, NO uses alias a menos que sea absolutamente necesario.
11. Agrega alias descriptivos a columnas calculadas: SUM(Monto) AS total_ventas.
12. Genera SQL COMPACTO. NUNCA uses UNION ALL — usa CASE+GROUP BY para categorizar datos en una sola query.
13. SIEMPRE verifica que el SQL sea COMPLETO: sin comillas sin cerrar, sin CASE sin END, sin paréntesis sin cerrar.
14. El project ID es largo (\`${BQ_PROJECT}\`), así que MINIMIZA la cantidad de tablas referenciadas. Usa JOIN una sola vez.`;

export async function generateSQL(
  question: string,
  module: BQModule,
  dateHint?: string,
  previousError?: string
): Promise<{ sql: string; error?: string }> {
  const schemaText = getSchemaText(module);
  const hints = MODULE_HINTS[module];

  const dateContext = dateHint
    ? `\nFecha/período solicitado: ${dateHint}`
    : `\nFecha actual: ${new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima" })}`;

  const errorContext = previousError
    ? `\n\nATENCIÓN: El SQL anterior falló con este error de BigQuery:\n${previousError}\nGenera un SQL corregido que evite este error.`
    : "";

  const userPrompt = `Esquema BigQuery disponible:
${schemaText}

Pistas importantes:
${hints}
${dateContext}${errorContext}

Pregunta del usuario: "${question}"

Genera el SQL:`;

  try {
    const result = await generateText({
      model: getModel(DEFAULT_MODEL_ID),
      system: SYSTEM_SQL,
      prompt: userPrompt,
      maxOutputTokens: 4096,
      temperature: 0.1,
    });

    let sql = result.text.trim();

    // Strip markdown code blocks if model added them
    sql = sql.replace(/^```sql\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

    // Basic safety check
    if (!sql.toUpperCase().startsWith("SELECT")) {
      return { sql: "", error: "El modelo no generó un SELECT válido" };
    }

    // Check for truncated SQL (unclosed CASE, strings, parens)
    const upper = sql.toUpperCase();
    const caseCount = (upper.match(/\bCASE\b/g) || []).length;
    const endCount  = (upper.match(/\bEND\b/g)  || []).length;
    if (caseCount > endCount) {
      return { sql: "", error: "SQL truncado: CASE sin END. Intenta generar SQL más compacto." };
    }
    const openParens  = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      return { sql: "", error: "SQL truncado: paréntesis sin cerrar. Intenta generar SQL más compacto." };
    }

    return { sql };
  } catch (err) {
    return { sql: "", error: String(err) };
  }
}
