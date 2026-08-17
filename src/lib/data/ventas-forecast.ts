/**
 * Pronóstico mensual de ventas calculado en la app (no depende del predictor Python).
 *
 * Método: media por día de semana de las últimas 4 semanas, excluyendo fechas
 * especiales del calendario, multiplicada por el uplift de la fecha cuando aplica.
 * Banda P25/P75 derivada de la dispersión del nivel semanal reciente.
 *
 * Elegido por backtest walk-forward de 18 meses (scripts/backtest-forecast.ts):
 * es el método mejor calibrado, con sesgo -1.49% (corte día 10) y -1.19% (día 20).
 * Se descartaron la mediana y la media recortada porque, al sumar una distribución
 * con cola derecha, subestiman el total (sesgo -2.1% a -3.7%).
 * También supera al algoritmo μ ± 0.5σ del predictor Python, que descarta 36-68%
 * de las observaciones y con el negocio en crecimiento termina promediando días de
 * hasta 168 días atrás: subestimó en 10 de los últimos 10 meses (sesgo -3.91%).
 */
import { BQ_PROJECT, executeBigQuery } from "./bigquery-client";

/** Semanas de histórico que alimentan la línea base por día de semana. */
const WEEKS_WINDOW = 4;
/** Semanas usadas para medir la variabilidad del nivel semanal (informativa). */
const BAND_WEEKS = 8;
/** Días de histórico a traer antes del inicio del mes objetivo. */
const HISTORY_DAYS = 84;
/**
 * Error relativo esperado del método por cada unidad de mes pendiente de proyectar.
 * Calibrado con el backtest de 18 meses: ~6.3% con 71% del mes por proyectar y
 * ~3.5% con 35%, que ajusta a una relación lineal de pendiente ~0.095.
 */
const ERROR_POR_FRACCION_PROYECTADA = 0.095;
/** MAE→sigma (0.798) y sigma→cuartil (0.674) para una normal. */
const CUARTIL_SOBRE_MAE = 0.674 / 0.798;

const DOW_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

/**
 * Uplift de fechas especiales respecto a la línea base del mismo día de semana.
 * Calculado sobre el histórico 2023-2026 de sales_df (mediana del ratio real/base).
 */
const HOLIDAY_UPLIFT: Record<string, number> = {
  "Halloween / Canción Criolla": 3.51,
  "Combate de Angamos": 2.49,
  "Día del Trabajo": 2.09,
  "Batalla de Junín": 1.94,
  "San Pedro y San Pablo": 1.61,
  "San Valentín": 1.44,
  "Día de la Madre": 1.38,
  "Todos los Santos": 1.29,
  "Inmaculada": 1.22,
  "Fiestas Patrias": 1.2,
  "Fin de Año": 1.19,
  "Santa Rosa": 1.02,
  "Día del Padre": 1.01,
  "Jueves Santo": 0.98,
  "Año Nuevo": 0.75,
  "Viernes Santo": 0.41,
  Nochebuena: 0.33,
};

/** Fechas fijas (MM-DD). */
const FIXED_DATES: Record<string, string> = {
  "01-01": "Año Nuevo",
  "02-14": "San Valentín",
  "05-01": "Día del Trabajo",
  "06-29": "San Pedro y San Pablo",
  "07-28": "Fiestas Patrias",
  "07-29": "Fiestas Patrias",
  "08-06": "Batalla de Junín",
  "08-30": "Santa Rosa",
  "10-08": "Combate de Angamos",
  "10-31": "Halloween / Canción Criolla",
  "11-01": "Todos los Santos",
  "12-08": "Inmaculada",
  "12-24": "Nochebuena",
  "12-25": "Navidad",
  "12-31": "Fin de Año",
};

/** Fechas móviles (YYYY-MM-DD). Ampliar cada año. */
const MOVABLE_DATES: Record<string, string> = {
  "2025-04-17": "Jueves Santo",
  "2025-04-18": "Viernes Santo",
  "2025-05-11": "Día de la Madre",
  "2025-06-15": "Día del Padre",
  "2026-04-02": "Jueves Santo",
  "2026-04-03": "Viernes Santo",
  "2026-05-10": "Día de la Madre",
  "2026-06-21": "Día del Padre",
  "2027-03-25": "Jueves Santo",
  "2027-03-26": "Viernes Santo",
  "2027-05-09": "Día de la Madre",
  "2027-06-20": "Día del Padre",
};

export function fechaEspecial(isoDate: string): string | null {
  return MOVABLE_DATES[isoDate] ?? FIXED_DATES[isoDate.slice(5)] ?? null;
}

interface DiaVenta {
  fecha: string;
  ts: number;
  dow: number;
  venta: number;
}

export interface DiaProyectado {
  fecha: string;
  diaSemana: string;
  base: number;
  fechaEspecial: string | null;
  factor: number;
  proyeccion: number;
}

export interface PronosticoMensual {
  anio: number;
  mes: number;
  ultimaFechaConDatos: string;
  diasConVentaReal: number;
  ventaRealAcumulada: number;
  diasProyectados: number;
  proyeccionRestante: number;
  totalEstimado: number;
  totalP25: number;
  totalP75: number;
  promedioDiarioReal: number;
  promedioDiarioProyectado: number;
  dispersionNivelSemanal: number;
  /** Error relativo esperado del pronóstico, en %, según cuánto falta por proyectar. */
  errorEsperadoPct: number;
  detalle: DiaProyectado[];
}

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 0 = Lunes ... 6 = Domingo */
function dowMonday0(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

interface DiaVentaLocatario extends DiaVenta {
  codigoNegocio: string;
  locatario: string;
}

async function fetchSerieDiaria(desde: string, hasta: string): Promise<DiaVenta[]> {
  const sql = `
SELECT
  SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 10) AS fecha,
  ROUND(SUM(Monto), 2) AS venta
FROM \`${BQ_PROJECT}.Ventas.sales_df\`
WHERE SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 10) >= '${desde}'
  AND SUBSTR(TRIM(CAST(Fecha AS STRING)), 1, 10) <= '${hasta}'
GROUP BY fecha
ORDER BY fecha
`.trim();

  const result = await executeBigQuery(sql, {
    maximumBytesBilled: 300 * 1024 * 1024,
    maxResults: 2000,
  });
  return result.rows
    .map((r) => {
      const fecha = String(r.fecha);
      const d = toUTC(fecha);
      return { fecha, ts: d.getTime(), dow: dowMonday0(d), venta: Number(r.venta) || 0 };
    })
    .filter((d) => d.venta > 0);
}

function escapeLike(s: string): string {
  return s.replace(/'/g, "''").replace(/[%_\\]/g, "\\$&");
}

async function fetchSerieDiariaPorLocatario(
  desde: string,
  hasta: string,
  locatarioHint?: string
): Promise<DiaVentaLocatario[]> {
  const hint = locatarioHint
    ? `AND UPPER(n.Descripcion) LIKE '%${escapeLike(locatarioHint.toUpperCase())}%'`
    : "";
  const sql = `
SELECT
  s.CodigoNegocio AS codigo,
  COALESCE(n.Descripcion, s.CodigoNegocio) AS locatario,
  SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10) AS fecha,
  ROUND(SUM(s.Monto), 2) AS venta
FROM \`${BQ_PROJECT}.Ventas.sales_df\` s
LEFT JOIN \`${BQ_PROJECT}.Ventas.Negocios\` n
  ON s.CodigoNegocio = n.CodigoNegocio
WHERE SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10) >= '${desde}'
  AND SUBSTR(TRIM(CAST(s.Fecha AS STRING)), 1, 10) <= '${hasta}'
  ${hint}
GROUP BY 1, 2, 3
ORDER BY 1, 3
`.trim();

  const result = await executeBigQuery(sql, {
    maximumBytesBilled: 400 * 1024 * 1024,
    maxResults: 5000,
    autoPaginate: true,
  });

  return result.rows
    .map((r) => {
      const fecha = String(r.fecha);
      const d = toUTC(fecha);
      return {
        codigoNegocio: String(r.codigo),
        locatario: String(r.locatario),
        fecha,
        ts: d.getTime(),
        dow: dowMonday0(d),
        venta: Number(r.venta) || 0,
      };
    })
    .filter((d) => d.venta > 0);
}

/**
 * Calcula el pronóstico del mes: venta real acumulada + proyección de días restantes.
 * Devuelve null si no hay datos reales del mes solicitado.
 */
export async function calcularPronosticoMensual(
  anio: number,
  mes: number
): Promise<PronosticoMensual | null> {
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1));
  const finMes = new Date(Date.UTC(anio, mes, 0));
  const inicioVentana = new Date(inicioMes.getTime() - HISTORY_DAYS * 86400000);

  const serie = await fetchSerieDiaria(iso(inicioVentana), iso(finMes));
  if (!serie.length) return null;

  const delMes = serie.filter((d) => d.fecha.slice(0, 7) === `${anio}-${pad(mes)}`);
  if (!delMes.length) return null;

  const ultimaFechaConDatos = delMes[delMes.length - 1].fecha;
  const corteTs = toUTC(ultimaFechaConDatos).getTime();
  const historia = serie.filter((d) => d.ts <= corteTs);

  // Línea base por día de semana: media de las últimas N semanas, sin fechas especiales.
  const historiaLimpia = historia.filter((d) => !fechaEspecial(d.fecha));
  const baseDow: Record<number, number> = {};
  for (let dow = 0; dow < 7; dow++) {
    const vals = historiaLimpia
      .filter((d) => d.dow === dow)
      .slice(-WEEKS_WINDOW)
      .map((d) => d.venta);
    baseDow[dow] = vals.length ? mean(vals) : mean(historiaLimpia.map((d) => d.venta));
  }

  // Días pendientes del mes
  const detalle: DiaProyectado[] = [];
  for (let t = corteTs + 86400000; t <= finMes.getTime(); t += 86400000) {
    const d = new Date(t);
    const fecha = iso(d);
    const dow = dowMonday0(d);
    const especial = fechaEspecial(fecha);
    const factor = especial ? HOLIDAY_UPLIFT[especial] ?? 1 : 1;
    const base = baseDow[dow] ?? 0;
    detalle.push({
      fecha,
      diaSemana: DOW_NAMES[dow],
      base: Math.round(base * 100) / 100,
      fechaEspecial: especial,
      factor,
      proyeccion: Math.round(base * factor * 100) / 100,
    });
  }

  const ventaRealAcumulada = delMes.reduce((a, b) => a + b.venta, 0);
  const proyeccionRestante = detalle.reduce((a, b) => a + b.proyeccion, 0);
  const totalEstimado = ventaRealAcumulada + proyeccionRestante;

  // Variabilidad del nivel semanal reciente (métrica informativa).
  const semanales: number[] = [];
  for (let i = BAND_WEEKS; i >= 1; i--) {
    const chunk = historia.slice(-7 * i, historia.length - 7 * (i - 1));
    if (chunk.length === 7) semanales.push(chunk.reduce((a, b) => a + b.venta, 0));
  }
  const nivelMedio = mean(semanales);
  const dispersion = nivelMedio > 0 ? stddev(semanales) / nivelMedio : 0;

  // Banda P25/P75 calibrada con el error real del método: crece con la porción
  // del mes que todavía hay que proyectar.
  const diasDelMes = finMes.getUTCDate();
  const fraccionProyectada = detalle.length / diasDelMes;
  const errorEsperado = ERROR_POR_FRACCION_PROYECTADA * fraccionProyectada;
  const margen = totalEstimado * errorEsperado * CUARTIL_SOBRE_MAE;

  return {
    anio,
    mes,
    ultimaFechaConDatos,
    diasConVentaReal: delMes.length,
    ventaRealAcumulada: Math.round(ventaRealAcumulada * 100) / 100,
    diasProyectados: detalle.length,
    proyeccionRestante: Math.round(proyeccionRestante * 100) / 100,
    totalEstimado: Math.round(totalEstimado * 100) / 100,
    totalP25: Math.round((totalEstimado - margen) * 100) / 100,
    totalP75: Math.round((totalEstimado + margen) * 100) / 100,
    promedioDiarioReal: Math.round((ventaRealAcumulada / delMes.length) * 100) / 100,
    promedioDiarioProyectado: detalle.length
      ? Math.round((proyeccionRestante / detalle.length) * 100) / 100
      : 0,
    dispersionNivelSemanal: Math.round(dispersion * 1000) / 10,
    errorEsperadoPct: Math.round(errorEsperado * 1000) / 10,
    detalle,
  };
}

export interface PronosticoLocatarioFila {
  codigoNegocio: string;
  locatario: string;
  diasConVentaReal: number;
  ventaRealAcumulada: number;
  diasProyectados: number;
  proyeccionRestante: number;
  totalEstimado: number;
}

export interface PronosticoPorLocatario {
  anio: number;
  mes: number;
  ultimaFechaConDatos: string;
  filtro?: string;
  filas: PronosticoLocatarioFila[];
}

/**
 * Pronóstico mensual por locatario con el mismo método DOW×calendario.
 * La tabla BQ `Pronostico` está desactualizada (último dato ~2025-12), por eso
 * se recalcula desde sales_df.
 */
export async function calcularPronosticoPorLocatario(
  anio: number,
  mes: number,
  locatarioHint?: string
): Promise<PronosticoPorLocatario | null> {
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1));
  const finMes = new Date(Date.UTC(anio, mes, 0));
  const inicioVentana = new Date(inicioMes.getTime() - HISTORY_DAYS * 86400000);
  const ym = `${anio}-${pad(mes)}`;

  const serie = await fetchSerieDiariaPorLocatario(
    iso(inicioVentana),
    iso(finMes),
    locatarioHint
  );
  if (!serie.length) return null;

  const delMesAll = serie.filter((d) => d.fecha.slice(0, 7) === ym);
  if (!delMesAll.length) return null;

  const ultimaFechaConDatos = delMesAll
    .map((d) => d.fecha)
    .sort()
    .at(-1)!;
  const corteTs = toUTC(ultimaFechaConDatos).getTime();

  const byNegocio = new Map<string, DiaVentaLocatario[]>();
  for (const d of serie) {
    const list = byNegocio.get(d.codigoNegocio) ?? [];
    list.push(d);
    byNegocio.set(d.codigoNegocio, list);
  }

  const filas: PronosticoLocatarioFila[] = [];
  for (const [codigo, dias] of byNegocio) {
    const delMes = dias.filter((d) => d.fecha.slice(0, 7) === ym && d.ts <= corteTs);
    if (!delMes.length) continue;

    const historia = dias.filter((d) => d.ts <= corteTs);
    const limpia = historia.filter((d) => !fechaEspecial(d.fecha));
    const baseDow: Record<number, number> = {};
    for (let dow = 0; dow < 7; dow++) {
      const vals = limpia
        .filter((d) => d.dow === dow)
        .slice(-WEEKS_WINDOW)
        .map((d) => d.venta);
      baseDow[dow] = vals.length ? mean(vals) : mean(limpia.map((d) => d.venta));
    }

    let proyeccionRestante = 0;
    let diasProyectados = 0;
    for (let t = corteTs + 86400000; t <= finMes.getTime(); t += 86400000) {
      const d = new Date(t);
      const especial = fechaEspecial(iso(d));
      const factor = especial ? HOLIDAY_UPLIFT[especial] ?? 1 : 1;
      proyeccionRestante += (baseDow[dowMonday0(d)] ?? 0) * factor;
      diasProyectados++;
    }

    const ventaRealAcumulada = delMes.reduce((a, b) => a + b.venta, 0);
    filas.push({
      codigoNegocio: codigo,
      locatario: delMes[0]?.locatario ?? codigo,
      diasConVentaReal: new Set(delMes.map((d) => d.fecha)).size,
      ventaRealAcumulada: Math.round(ventaRealAcumulada * 100) / 100,
      diasProyectados,
      proyeccionRestante: Math.round(proyeccionRestante * 100) / 100,
      totalEstimado: Math.round((ventaRealAcumulada + proyeccionRestante) * 100) / 100,
    });
  }

  filas.sort((a, b) => b.totalEstimado - a.totalEstimado);

  return {
    anio,
    mes,
    ultimaFechaConDatos,
    filtro: locatarioHint,
    filas,
  };
}

const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPronosticoLocatarioParaIA(p: PronosticoPorLocatario): string {
  const lines: string[] = [];
  const titulo = p.filtro
    ? `Estimación por locatario — ${MESES_ES[p.mes - 1]} ${p.anio} (filtro: ${p.filtro})`
    : `Estimación por locatario — ${MESES_ES[p.mes - 1]} ${p.anio}`;

  lines.push(
    `**${titulo}**`,
    "",
    `Método: media DOW últimas ${WEEKS_WINDOW} semanas + calendario (misma lógica del establecimiento).`,
    `Última fecha con datos reales: ${p.ultimaFechaConDatos}.`,
    `Nota: la tabla BQ \`Pronostico\` no tiene datos de ${p.anio}; esta estimación se calcula desde sales_df.`,
    "",
    "| Locatario | Código | Días real | Venta real | Días proy. | Proyección | Total estimado |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |"
  );

  for (const f of p.filas.slice(0, 30)) {
    lines.push(
      `| ${f.locatario} | ${f.codigoNegocio} | ${f.diasConVentaReal} | ${money(
        f.ventaRealAcumulada
      )} | ${f.diasProyectados} | ${money(f.proyeccionRestante)} | ${money(f.totalEstimado)} |`
    );
  }

  const totReal = p.filas.reduce((a, b) => a + b.ventaRealAcumulada, 0);
  const totProy = p.filas.reduce((a, b) => a + b.proyeccionRestante, 0);
  lines.push(
    "",
    `Suma locatarios listados: real ${money(totReal)} + proyectado ${money(totProy)} = ${money(
      totReal + totProy
    )} (${p.filas.length} negocios).`
  );

  return lines.join("\n");
}

/** Formatea el pronóstico como contexto markdown para el modelo. */
export function formatPronosticoParaIA(p: PronosticoMensual): string {
  const lines: string[] = [];
  lines.push(
    `**Estimación recalculada por el sistema — ${MESES_ES[p.mes - 1]} ${p.anio}**`,
    "",
    `Método: media por día de semana de las últimas ${WEEKS_WINDOW} semanas (excluyendo fechas especiales), ajustada por calendario. Sesgo medido en backtest de 18 meses: -1.5%.`,
    "",
    "| Concepto | Valor |",
    "| --- | --- |",
    `| Última fecha con datos reales | ${p.ultimaFechaConDatos} |`,
    `| Días con venta real | ${p.diasConVentaReal} |`,
    `| Venta real acumulada | ${money(p.ventaRealAcumulada)} |`,
    `| Promedio diario real | ${money(p.promedioDiarioReal)} |`,
    `| Días por proyectar | ${p.diasProyectados} |`,
    `| Proyección de días restantes | ${money(p.proyeccionRestante)} |`,
    `| Promedio diario proyectado | ${money(p.promedioDiarioProyectado)} |`,
    `| **Total estimado del mes** | **${money(p.totalEstimado)}** |`,
    `| Escenario conservador (P25) | ${money(p.totalP25)} |`,
    `| Escenario optimista (P75) | ${money(p.totalP75)} |`,
    `| Error esperado del pronóstico | ±${p.errorEsperadoPct}% |`,
    `| Variabilidad del nivel semanal | ${p.dispersionNivelSemanal}% |`
  );

  const especiales = p.detalle.filter((d) => d.fechaEspecial);
  if (especiales.length) {
    lines.push(
      "",
      "**Fechas especiales incluidas en la proyección:**",
      "",
      "| Fecha | Día | Motivo | Factor | Proyección |",
      "| --- | --- | --- | --- | --- |"
    );
    for (const d of especiales) {
      lines.push(
        `| ${d.fecha} | ${d.diaSemana} | ${d.fechaEspecial} | x${d.factor.toFixed(2)} | ${money(
          d.proyeccion
        )} |`
      );
    }
  }

  return lines.join("\n");
}
