import { BigQuery } from "@google-cloud/bigquery";

// BigQuery project and schema constants
export const BQ_PROJECT = "neat-chain-450900-a1";
export const BQ_LOCATION = "US";

/** Catálogo verificado vía INFORMATION_SCHEMA (2026-06). Fuente única para chat/SQL generator. */
export const BQ_CATALOG = {
  Ventas: [
    "sales_df",
    "Negocios",
    "Categorias",
    "Presupuesto",
    "MontosMeta",
    "MontosMetaMicro",
    "Predicciones",
    "Pronostico",
  ],
  Estacionamiento: [
    "Registro",
    "Vehiculos",
    "Lugares",
    "Tarifas_horarias",
    "Tarifas_excepcionales",
    "Visitantes_proveedores",
  ],
  flujo_de_personas: ["Personas_por_zonas", "Total_Puertas_Hora"],
} as const;

export const BQ_SCHEMA = {
  Ventas: {
    description:
      "Ventas diarias de Refugio Gastronómico: transacciones, negocios, categorías, presupuesto y pronósticos.",
    tables: {
      sales_df: {
        rows: 525438,
        columns:
          "Fecha(STRING), Hora(STRING), CodigoTransaccion(STRING), Producto(STRING), Cliente(STRING), CodigoNegocio(STRING), Monto(FLOAT), Cantidad(FLOAT), Turno(STRING), Estado(STRING), FormaPago(STRING), FormaPagoModificado(STRING), TipoIngreso(STRING), CategoriaProducto(STRING), TipoNegocio(STRING)",
        notes:
          "Detalle de ventas reales ya realizadas. Fecha 'YYYY-MM-DD'. Hora 'HH:MM:SS'. Turno: 'Mañana' o 'Noche'. Medios de pago: usar FormaPagoModificado (con fallback a FormaPago si vacío). TipoIngreso='EVENTO' identifica ingresos por evento realizado (no confundir con venta de salón/operación regular). Para categorías preferir JOIN Categorias por Producto (CategoriaProducto es auxiliar).",
      },
      Negocios: {
        rows: 60,
        columns:
          "CodigoNegocio(STRING), Descripcion(STRING), Zona(STRING), TipoComida(STRING), TipoNegocio(STRING), Estado(FLOAT)",
        notes:
          "Detalle de locatarios de Refugio Gastronómico. Dimensión maestra de negocios; JOIN con sales_df / MontosMetaMicro / Pronostico por CodigoNegocio. Predicciones NO tiene CodigoNegocio. Usar Descripcion para filtrar por nombre de locatario.",
      },
      Categorias: {
        rows: 1247,
        columns: "Producto(STRING), Categoria(STRING), Nacionalidad(STRING)",
        notes:
          "Detalle de categoría y productos. JOIN con sales_df por Producto para agrupar o filtrar por Categoria.",
      },
      Presupuesto: {
        rows: 324,
        columns:
          "CodigoNegocio(STRING), Mes(STRING), Venta(FLOAT), YearMes(STRING), Anio_Presupuesto(STRING), Activo(INTEGER)",
        notes: "Presupuesto mensual por negocio.",
      },
      MontosMeta: {
        rows: 365,
        columns: "Anio(INTEGER), Mes(STRING), nrosemana(INTEGER), Fecha(DATE), MontoMeta(FLOAT)",
        notes:
          "Proyección meta del establecimiento completo de Refugio Gastronómico (meta global del complejo, no por locatario). Comparar contra SUM(sales_df.Monto) del mismo periodo. Mes es nombre en español (ej: 'Agosto').",
      },
      MontosMetaMicro: {
        columns:
          "Anio(INTEGER), Mes(STRING), Nrosemana(INTEGER), TipoNegocio(STRING), CodigoNegocio(STRING), Fecha(DATE), MontoMeta(FLOAT), MontoMetaPropioLocatario(FLOAT)",
        notes:
          "Proyección meta de cada locatario del establecimiento. Preferir JOIN Negocios por CodigoNegocio cuando no sea NULL; si CodigoNegocio es NULL usar TipoNegocio como identificador del locatario. Comparar contra ventas reales del mismo periodo. Mes es nombre en español (ej: 'Agosto').",
      },
      Predicciones: {
        columns:
          "Fecha(DATE), NroSemana(INTEGER), Anio(INTEGER), Mes(INTEGER), Ventas(FLOAT), VentasProyectadas(FLOAT), FechaActualizacion(TIMESTAMP)",
        notes:
          "Predicción a nivel establecimiento completo (NO tiene CodigoNegocio). Para fechas restantes a fin de mes usar VentasProyectadas; Ventas refleja lo ya observado/referencial del día. Sirve para estimar cierre de mes. No es meta (MontosMeta) ni detalle transaccional (sales_df).",
      },
      Pronostico: {
        columns:
          "Fecha(DATETIME), DiaSemana(INTEGER), EsFeriado(INTEGER), Tendencia(INTEGER), Predicted_Ventas(FLOAT), CodigoNegocio(STRING), Presupuesto_Porcentaje(FLOAT), Predicted_Ventas_Locatario(FLOAT), Año(INTEGER)",
        notes:
          "Histórico de pronóstico DIARIO por locatario (sí tiene CodigoNegocio). Última carga ~2025-12: NO usar para meses 2026+. Para cierre de mes por locatario el asistente recalcula desde sales_df (media DOW). Distinto de Predicciones (establecimiento).",
      },
    },
  },
  Estacionamiento: {
    description:
      "Control de vehículos: movimientos entrada/salida, abonados, tarifas y visitantes.",
    tables: {
      Registro: {
        rows: 2969,
        columns:
          "fecha(DATE), hora(TIME), tipo_camara(STRING), codigo_lugar(INTEGER), placa(STRING), color(STRING), marca(STRING)",
        notes:
          "Registro de movimientos del estacionamiento (entrada/salida). tipo_camara='entrada' o 'salida'. JOIN Lugares por codigo_lugar para nombre y capacidad de zona.",
      },
      Vehiculos: {
        rows: 2379,
        columns: "id_placa(STRING), placa(STRING)",
        notes: "Vehículos únicos registrados.",
      },
      Lugares: {
        rows: 3,
        columns:
          "codigo_lugar(INTEGER), nombre_lugar(STRING), capacidad_maxima(INTEGER)",
        notes:
          "Catálogo de lugares/zonas del estacionamiento (nombre y capacidad máxima). JOIN con Registro por codigo_lugar.",
      },
      Tarifas_horarias: {
        columns: "codigo_lugar(INTEGER), hora_inicio(TIME), hora_fin(TIME), tarifa(FLOAT)",
        notes: "Tarifas por franja horaria.",
      },
      Tarifas_excepcionales: {
        columns: "fecha(DATE), tarifa(FLOAT), motivo(STRING)",
        notes: "Tarifas especiales por fecha.",
      },
      Visitantes_proveedores: {
        columns: "placa(STRING), nombre(STRING), tipo(STRING), fecha_inicio(DATE), fecha_fin(DATE)",
        notes: "Visitantes y proveedores con acceso registrado.",
      },
    },
  },
  flujo_de_personas: {
    description: "Conteo de visitantes por hora, zona y puerta en Refugio Gastronómico.",
    tables: {
      Personas_por_zonas: {
        rows: 144467,
        columns:
          "Fecha(DATE), Hora(TIME), Region(STRING), Personas(INTEGER), dia_semana(STRING)",
        notes:
          "Conteo de personas por zona (Region) y hora. Usar para afluencia espacial. dia_semana: Lunes, Martes, etc.",
      },
      Total_Puertas_Hora: {
        rows: 46238,
        columns:
          "Fecha(DATE), Hora(TIME), Entradas(FLOAT), Salidas(FLOAT), Puerta(INTEGER), Dia(STRING), Turno(STRING)",
        notes:
          "Total de entradas y salidas por puerta y hora. Usar para visitantes/ingresos al complejo (SUM(Entradas)).",
      },
    },
  },
};

let bqInstance: BigQuery | null = null;

function getBigQueryClient(): BigQuery {
  if (bqInstance) return bqInstance;

  const credsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credsJson) {
    throw new Error("GOOGLE_CREDENTIALS_JSON env var not set");
  }

  const credentials = JSON.parse(credsJson);
  // Fix double-escaped newlines in private_key (common in .env files)
  if (credentials.private_key && typeof credentials.private_key === "string") {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  bqInstance = new BigQuery({
    projectId: BQ_PROJECT,
    credentials,
  });
  return bqInstance;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  schema: Array<{ name: string; type: string }>;
  rowCount: number;
  sql: string;
}

export interface ExecuteBigQueryOptions {
  /** Default 100MB. */
  maximumBytesBilled?: number;
  /** Default 500. Use higher for series diarias multi-locatario. */
  maxResults?: number;
  /** Default false. */
  autoPaginate?: boolean;
}

export async function executeBigQuery(
  sql: string,
  options: ExecuteBigQueryOptions = {}
): Promise<QueryResult> {
  const bq = getBigQueryClient();
  const maximumBytesBilled = options.maximumBytesBilled ?? 100 * 1024 * 1024;
  const maxResults = options.maxResults ?? 500;
  const autoPaginate = options.autoPaginate ?? false;

  const [job] = await bq.createQueryJob({
    query: sql,
    location: "US",
    maximumBytesBilled: String(maximumBytesBilled),
  });

  const [rows, , metadata] = await job.getQueryResults({
    autoPaginate,
    maxResults: autoPaginate ? undefined : maxResults,
  });

  const schema =
    metadata?.schema?.fields?.map((f) => ({
      name: f.name ?? "",
      type: f.type ?? "STRING",
    })) || [];

  return {
    rows: rows as Record<string, unknown>[],
    schema,
    rowCount: rows.length,
    sql,
  };
}

export function formatQueryResult(result: QueryResult): string {
  if (result.rowCount === 0) return "La consulta no retornó datos.";

  const { rows, schema } = result;

  // Markdown table
  const headers = schema.length > 0 ? schema.map((s) => s.name) : Object.keys(rows[0]);
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;

  const tableRows = rows.slice(0, 100).map((row) => {
    const cells = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "—";
      if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(2);
      if (val && typeof val === "object" && "value" in val) return String((val as { value: unknown }).value);
      return String(val);
    });
    return `| ${cells.join(" | ")} |`;
  });

  let table = [header, separator, ...tableRows].join("\n");
  if (result.rowCount > 100) {
    table += `\n\n*(Mostrando 100 de ${result.rowCount} filas)*`;
  }

  return table;
}

export function getSchemaText(module: "ventas" | "estacionamiento" | "flujo"): string {
  const datasetMap: Record<string, keyof typeof BQ_SCHEMA> = {
    ventas: "Ventas",
    estacionamiento: "Estacionamiento",
    flujo: "flujo_de_personas",
  };

  const datasetKey = datasetMap[module];
  const dataset = BQ_SCHEMA[datasetKey];
  if (!dataset) return "";

  const lines: string[] = [
    `Dataset: ${datasetKey}`,
    `Descripción: ${dataset.description}`,
    "",
    "Tablas disponibles:",
  ];

  for (const [tableName, info] of Object.entries(dataset.tables)) {
    const rowLabel = "rows" in info && info.rows != null ? ` (${info.rows.toLocaleString()} filas)` : "";
    lines.push(`\n### \`${datasetKey}.${tableName}\`${rowLabel}`);
    lines.push(`Columnas: ${info.columns}`);
    if (info.notes) lines.push(`Nota: ${info.notes}`);
  }

  return lines.join("\n");
}
