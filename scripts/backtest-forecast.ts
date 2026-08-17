/**
 * Backtest walk-forward de métodos de pronóstico mensual de ventas.
 * Compara el algoritmo actual (mu +- k*sigma, últimos 6 in-band por DOW)
 * contra alternativas, midiendo error sobre el TOTAL DEL MES.
 *
 * Uso: npx tsx scripts/backtest-forecast.ts
 */
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

/** Runner propio: el cliente de la app limita a 500 filas, aquí necesitamos la serie completa. */
async function runQuery(sql: string): Promise<Record<string, unknown>[]> {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON!);
  if (typeof credentials.private_key === "string") {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  const bq = new BigQuery({ projectId: "neat-chain-450900-a1", credentials });
  const [job] = await bq.createQueryJob({
    query: sql,
    location: "US",
    maximumBytesBilled: String(500 * 1024 * 1024),
  });
  const [rows] = await job.getQueryResults();
  return rows as Record<string, unknown>[];
}

interface Day {
  date: string; // YYYY-MM-DD
  ts: number;
  dow: number; // 0=Lunes .. 6=Domingo
  venta: number;
}

function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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

function stddev(xs: number[], ddof = 1): number {
  if (xs.length <= ddof) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - ddof);
  return Math.sqrt(v);
}

type Forecaster = (history: Day[], targetDates: Date[]) => number[];

/** Ventana de histórico que usa el script real: HISTORICAL_MONTHS_BACK = 18. */
function window18m(history: Day[]): Day[] {
  if (!history.length) return history;
  const last = history[history.length - 1].ts;
  const cutoff = last - 18 * 30.44 * 86400000;
  return history.filter((h) => h.ts >= cutoff);
}

/** A) Algoritmo actual: mu +- 0.5 sigma sobre 18 meses por DOW, media de últimos 6 in-band. */
const currentAlgo: Forecaster = (fullHistory, targets) => {
  const K = 0.5;
  const history = window18m(fullHistory);
  const base: Record<number, number> = {};
  for (let dow = 0; dow < 7; dow++) {
    const vals = history.filter((h) => h.dow === dow);
    if (!vals.length) {
      base[dow] = 0;
      continue;
    }
    const v = vals.map((x) => x.venta);
    const mu = mean(v);
    const sd = stddev(v);
    const lie = mu - K * sd;
    const lse = mu + K * sd;
    const inside = vals.filter((x) => x.venta >= lie && x.venta <= lse);
    let last6 = inside.slice(-6).map((x) => x.venta);
    if (last6.length < 6) {
      const fill = inside.length ? mean(inside.map((x) => x.venta)) : mu;
      last6 = last6.concat(Array(6 - last6.length).fill(fill));
    }
    base[dow] = mean(last6);
  }
  return targets.map((d) => base[dowMonday0(d)] ?? 0);
};

/** B) Media DOW de las últimas 4 semanas. */
const dowLast4: Forecaster = (history, targets) => {
  const base: Record<number, number> = {};
  for (let dow = 0; dow < 7; dow++) {
    const vals = history.filter((h) => h.dow === dow).slice(-4);
    base[dow] = mean(vals.map((x) => x.venta));
  }
  return targets.map((d) => base[dowMonday0(d)] ?? 0);
};

/** C) Mediana DOW de las últimas 8 semanas (robusta a outliers). */
const dowMedian8: Forecaster = (history, targets) => {
  const base: Record<number, number> = {};
  for (let dow = 0; dow < 7; dow++) {
    const vals = history.filter((h) => h.dow === dow).slice(-8);
    base[dow] = median(vals.map((x) => x.venta));
  }
  return targets.map((d) => base[dowMonday0(d)] ?? 0);
};

/** D) Nivel reciente (28d) x factor DOW (12 semanas). Descomposición multiplicativa. */
const levelTimesDow: Forecaster = (history, targets) => {
  const last28 = history.slice(-28);
  const level = mean(last28.map((x) => x.venta));
  const window = history.slice(-84);
  const overall = mean(window.map((x) => x.venta)) || 1;
  const factor: Record<number, number> = {};
  for (let dow = 0; dow < 7; dow++) {
    const vals = window.filter((h) => h.dow === dow).map((x) => x.venta);
    factor[dow] = vals.length ? median(vals) / overall : 1;
  }
  // normalizar factores para que el promedio semanal sea 1
  const fMean = mean(Object.values(factor)) || 1;
  for (let dow = 0; dow < 7; dow++) factor[dow] /= fMean;
  return targets.map((d) => level * (factor[dowMonday0(d)] ?? 1));
};

/** E) D + tendencia lineal sobre el nivel semanal de las últimas 8 semanas. */
const levelTrendDow: Forecaster = (history, targets) => {
  const window = history.slice(-84);
  const overall = mean(window.map((x) => x.venta)) || 1;
  const factor: Record<number, number> = {};
  for (let dow = 0; dow < 7; dow++) {
    const vals = window.filter((h) => h.dow === dow).map((x) => x.venta);
    factor[dow] = vals.length ? median(vals) / overall : 1;
  }
  const fMean = mean(Object.values(factor)) || 1;
  for (let dow = 0; dow < 7; dow++) factor[dow] /= fMean;

  // nivel semanal (medias de 7 días) últimas 8 semanas -> regresión lineal
  const weeks: number[] = [];
  for (let i = 8; i >= 1; i--) {
    const chunk = history.slice(-7 * i, history.length - 7 * (i - 1));
    if (chunk.length) weeks.push(mean(chunk.map((x) => x.venta)));
  }
  const n = weeks.length;
  let slope = 0;
  let intercept = weeks.length ? weeks[weeks.length - 1] : 0;
  if (n >= 3) {
    const xs = weeks.map((_, i) => i);
    const xm = mean(xs);
    const ym = mean(weeks);
    const num = xs.reduce((a, x, i) => a + (x - xm) * (weeks[i] - ym), 0);
    const den = xs.reduce((a, x) => a + (x - xm) ** 2, 0) || 1;
    slope = num / den;
    intercept = ym + slope * (n - 1 - xm);
  }
  // amortiguar la tendencia (damped trend) para no extrapolar de más
  const damp = 0.5;
  const lastTs = history.length ? history[history.length - 1].ts : Date.now();
  return targets.map((d) => {
    const weeksAhead = (d.getTime() - lastTs) / (7 * 86400000);
    const level = Math.max(0, intercept + slope * damp * weeksAhead);
    return level * (factor[dowMonday0(d)] ?? 1);
  });
};

/** F) Mismo mes del año anterior escalado por crecimiento YoY reciente. */
function yoyFactory(all: Day[]): Forecaster {
  const byDate = new Map(all.map((d) => [d.date, d.venta]));
  return (history, targets) => {
    // crecimiento YoY: últimos 56 días vs mismos 56 días del año anterior
    const recent = history.slice(-56);
    const recentSum = recent.reduce((a, b) => a + b.venta, 0);
    let prevSum = 0;
    for (const d of recent) {
      const dt = toDate(d.date);
      dt.setUTCFullYear(dt.getUTCFullYear() - 1);
      prevSum += byDate.get(fmt(dt)) ?? 0;
    }
    const growth = prevSum > 0 ? recentSum / prevSum : 1;
    const fallback = dowLast4(history, targets);
    return targets.map((d, i) => {
      const dt = new Date(d.getTime());
      dt.setUTCFullYear(dt.getUTCFullYear() - 1);
      // alinear por día de semana: buscar la fecha del año pasado con mismo DOW más cercana
      let best: number | null = null;
      for (let off = -3; off <= 3; off++) {
        const c = new Date(dt.getTime() + off * 86400000);
        if (dowMonday0(c) !== dowMonday0(d)) continue;
        const v = byDate.get(fmt(c));
        if (v != null) best = v;
      }
      return best != null ? best * growth : fallback[i];
    });
  };
}

/** Feriados y fechas comerciales relevantes en Perú (impacto gastronómico). */
const HOLIDAYS: Record<string, string> = {
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

/** Fechas móviles: Semana Santa, Día de la Madre, Día del Padre. */
const MOVABLE: Record<string, string> = {
  "2024-03-28": "Jueves Santo",
  "2024-03-29": "Viernes Santo",
  "2025-04-17": "Jueves Santo",
  "2025-04-18": "Viernes Santo",
  "2026-04-02": "Jueves Santo",
  "2026-04-03": "Viernes Santo",
  "2024-05-12": "Día de la Madre",
  "2025-05-11": "Día de la Madre",
  "2026-05-10": "Día de la Madre",
  "2024-06-16": "Día del Padre",
  "2025-06-15": "Día del Padre",
  "2026-06-21": "Día del Padre",
};

function holidayName(date: string): string | null {
  return MOVABLE[date] ?? HOLIDAYS[date.slice(5)] ?? null;
}

/** G) Media DOW últimas 4 semanas, excluyendo días festivos del histórico. */
const dowLast4NoHoliday: Forecaster = (history, targets) => {
  const clean = history.filter((h) => !holidayName(h.date));
  const base: Record<number, number> = {};
  for (let dow = 0; dow < 7; dow++) {
    const vals = clean.filter((h) => h.dow === dow).slice(-4);
    base[dow] = mean(vals.map((x) => x.venta));
  }
  return targets.map((d) => base[dowMonday0(d)] ?? 0);
};

/** Uplift histórico de cada feriado respecto a su línea base DOW. */
function buildHolidayUplift(all: Day[]): Record<string, number> {
  const uplift: Record<string, number[]> = {};
  for (let i = 0; i < all.length; i++) {
    const day = all[i];
    const name = holidayName(day.date);
    if (!name) continue;
    const prior = all
      .slice(0, i)
      .filter((h) => h.dow === day.dow && !holidayName(h.date))
      .slice(-4);
    const baseline = mean(prior.map((x) => x.venta));
    if (baseline > 0) {
      (uplift[name] ??= []).push(day.venta / baseline);
    }
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(uplift)) out[k] = median(v);
  return out;
}

/** H) G + ajuste por feriado (uplift histórico mediano). */
function holidayAwareFactory(all: Day[]): Forecaster {
  const uplift = buildHolidayUplift(all);
  return (history, targets) => {
    const base = dowLast4NoHoliday(history, targets);
    return targets.map((d, i) => {
      const name = holidayName(fmt(d));
      const factor = name ? uplift[name] ?? 1 : 1;
      return base[i] * factor;
    });
  };
}

/** Variante del módulo de producción: base DOW sin feriados × uplift, media o mediana. */
function moduloFactory(
  all: Day[],
  weeks: number,
  agg: "mean" | "median"
): Forecaster {
  const uplift = buildHolidayUplift(all);
  const fn = agg === "mean" ? mean : median;
  return (history, targets) => {
    const clean = history.filter((h) => !holidayName(h.date));
    const base: Record<number, number> = {};
    for (let dow = 0; dow < 7; dow++) {
      const vals = clean.filter((h) => h.dow === dow).slice(-weeks).map((x) => x.venta);
      base[dow] = vals.length ? fn(vals) : fn(clean.map((x) => x.venta));
    }
    return targets.map((d) => {
      const name = holidayName(fmt(d));
      const factor = name ? uplift[name] ?? 1 : 1;
      return (base[dowMonday0(d)] ?? 0) * factor;
    });
  };
}

/** Media recortada: descarta el mínimo y el máximo antes de promediar. */
function trimmedMean(xs: number[]): number {
  if (xs.length < 4) return mean(xs);
  const s = [...xs].sort((a, b) => a - b);
  return mean(s.slice(1, -1));
}

/** Variante robusta: media recortada de las últimas N semanas sin feriados × uplift. */
function moduloTrimFactory(all: Day[], weeks: number): Forecaster {
  const uplift = buildHolidayUplift(all);
  return (history, targets) => {
    const clean = history.filter((h) => !holidayName(h.date));
    const base: Record<number, number> = {};
    for (let dow = 0; dow < 7; dow++) {
      const vals = clean.filter((h) => h.dow === dow).slice(-weeks).map((x) => x.venta);
      base[dow] = vals.length ? trimmedMean(vals) : trimmedMean(clean.map((x) => x.venta));
    }
    return targets.map((d) => {
      const name = holidayName(fmt(d));
      const factor = name ? uplift[name] ?? 1 : 1;
      return (base[dowMonday0(d)] ?? 0) * factor;
    });
  };
}

/** I) Ensemble: mediana de B, C, D por día. */
const ensemble: Forecaster = (history, targets) => {
  const b = dowLast4(history, targets);
  const c = dowMedian8(history, targets);
  const d = levelTimesDow(history, targets);
  return targets.map((_, i) => median([b[i], c[i], d[i]]));
};

const METHODS: Array<{ name: string; fn: Forecaster }> = [];

async function main() {
  loadEnvLocal();

  const maxRow = await runQuery(
    `SELECT MAX(LEFT(Fecha,10)) AS max_fecha, MIN(LEFT(Fecha,10)) AS min_fecha
     FROM \`neat-chain-450900-a1.Ventas.sales_df\``
  );
  console.log("Rango sales_df:", JSON.stringify(maxRow[0]));

  const daily = await runQuery(
    `SELECT LEFT(Fecha,10) AS f, ROUND(SUM(Monto),2) AS v
     FROM \`neat-chain-450900-a1.Ventas.sales_df\`
     WHERE LEFT(Fecha,10) >= '2023-06-01'
     GROUP BY f
     ORDER BY f`
  );

  const series: Day[] = daily
    .map((r) => {
      const date = String(r.f);
      const d = toDate(date);
      return { date, ts: d.getTime(), dow: dowMonday0(d), venta: Number(r.v) || 0 };
    })
    .filter((d) => d.venta > 0);

  console.log(`Días con venta: ${series.length} (${series[0]?.date} .. ${series[series.length - 1]?.date})`);

  // Detectar huecos de calendario
  const set = new Set(series.map((s) => s.date));
  let gaps = 0;
  const start = toDate(series[0].date);
  const end = toDate(series[series.length - 1].date);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    if (!set.has(fmt(new Date(t)))) gaps++;
  }
  console.log(`Días sin registro dentro del rango: ${gaps}`);

  METHODS.push(
    { name: "A) Actual (mu±0.5σ, últ.6 in-band)", fn: currentAlgo },
    { name: "B) Media DOW últimas 4 semanas", fn: dowLast4 },
    { name: "C) Mediana DOW últimas 8 semanas", fn: dowMedian8 },
    { name: "D) Nivel 28d × factor DOW", fn: levelTimesDow },
    { name: "E) Nivel+tendencia × factor DOW", fn: levelTrendDow },
    { name: "F) YoY mismo mes escalado", fn: yoyFactory(series) },
    { name: "G) DOW 4 sem sin feriados", fn: dowLast4NoHoliday },
    { name: "H) G + uplift de feriados", fn: holidayAwareFactory(series) },
    { name: "I) Ensemble mediana(B,C,D)", fn: ensemble },
    { name: "M4-media) módulo: media 4 sem + uplift", fn: moduloFactory(series, 4, "mean") },
    { name: "M8-media) módulo: media 8 sem + uplift", fn: moduloFactory(series, 8, "mean") },
    { name: "M4-mediana) módulo: mediana 4 sem + uplift", fn: moduloFactory(series, 4, "median") },
    { name: "M8-mediana) módulo: mediana 8 sem + uplift", fn: moduloFactory(series, 8, "median") },
    { name: "T6) módulo: media recortada 6 sem + uplift", fn: moduloTrimFactory(series, 6) },
    { name: "T8) módulo: media recortada 8 sem + uplift", fn: moduloTrimFactory(series, 8) }
  );

  // Meses a evaluar: completos, con al menos 12 meses previos de historia
  const months = Array.from(new Set(series.map((s) => s.date.slice(0, 7)))).sort();
  const lastComplete = series[series.length - 1].date;
  const evalMonths = months.filter((m) => {
    const first = toDate(`${m}-01`);
    const nextM = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
    const monthEnd = new Date(nextM.getTime() - 86400000);
    return fmt(monthEnd) < lastComplete && m >= "2025-02";
  });

  // Cortes que imitan uso real: día 10 y día 20 del mes
  for (const cutDay of [10, 20]) {
    console.log(`\n========== CORTE: día ${cutDay} del mes ==========`);
    const errors: Record<string, number[]> = {};
    const biases: Record<string, number[]> = {};
    for (const m of METHODS) {
      errors[m.name] = [];
      biases[m.name] = [];
    }

    for (const ym of evalMonths) {
      const first = toDate(`${ym}-01`);
      const nextM = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
      const monthEnd = new Date(nextM.getTime() - 86400000);
      const cut = toDate(`${ym}-${String(cutDay).padStart(2, "0")}`);

      const history = series.filter((s) => s.ts <= cut.getTime());
      const actualMonth = series
        .filter((s) => s.date.slice(0, 7) === ym)
        .reduce((a, b) => a + b.venta, 0);
      const observed = series
        .filter((s) => s.date.slice(0, 7) === ym && s.ts <= cut.getTime())
        .reduce((a, b) => a + b.venta, 0);

      const targets: Date[] = [];
      for (let t = cut.getTime() + 86400000; t <= monthEnd.getTime(); t += 86400000) {
        targets.push(new Date(t));
      }
      if (!targets.length || actualMonth <= 0 || history.length < 120) continue;

      for (const m of METHODS) {
        const preds = m.fn(history, targets);
        const total = observed + preds.reduce((a, b) => a + b, 0);
        const err = (total - actualMonth) / actualMonth;
        errors[m.name].push(Math.abs(err) * 100);
        biases[m.name].push(err * 100);
      }
    }

    const rows = METHODS.map((m) => ({
      metodo: m.name,
      MAPE: mean(errors[m.name]).toFixed(2) + "%",
      sesgo: (mean(biases[m.name]) >= 0 ? "+" : "") + mean(biases[m.name]).toFixed(2) + "%",
      peor: Math.max(...errors[m.name]).toFixed(2) + "%",
      n: errors[m.name].length,
    }));
    rows.sort((a, b) => parseFloat(a.MAPE) - parseFloat(b.MAPE));
    console.table(rows);

    if (cutDay === 10) {
      console.log("\n--- Error por mes (corte día 10), métodos clave ---");
      const detail: Record<string, string>[] = [];
      evalMonths.forEach((ym, idx) => {
        const row: Record<string, string> = { mes: ym };
        for (const key of [
          "A) Actual (mu±0.5σ, últ.6 in-band)",
          "B) Media DOW últimas 4 semanas",
          "I) Ensemble mediana(B,C,D)",
        ]) {
          const v = biases[key]?.[idx];
          row[key.slice(0, 2)] = v == null ? "-" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
        }
        detail.push(row);
      });
      console.table(detail.slice(-10));
    }
  }

  // Nivel mensual reciente (¿hubo cambio de nivel?)
  console.log("\n=== Venta total por mes (últimos 15 meses) ===");
  const byMonth = new Map<string, number>();
  for (const d of series) {
    byMonth.set(d.date.slice(0, 7), (byMonth.get(d.date.slice(0, 7)) ?? 0) + d.venta);
  }
  const monthRows = [...byMonth.entries()]
    .sort()
    .slice(-15)
    .map(([m, v], i, arr) => {
      const prev = i > 0 ? arr[i - 1][1] : null;
      return {
        mes: m,
        total: Math.round(v).toLocaleString("es-PE"),
        "var vs mes ant.": prev ? `${(((v - prev) / prev) * 100).toFixed(1)}%` : "-",
      };
    });
  console.table(monthRows);

  // Efecto calendario: uplift de feriados vs línea base DOW
  console.log("\n=== Uplift histórico por fecha especial (vs media DOW previas 4 semanas) ===");
  const uplift = buildHolidayUplift(series);
  const upliftRows = Object.entries(uplift)
    .map(([k, v]) => ({ fecha: k, factor: `x${v.toFixed(2)}`, desvio: `${((v - 1) * 100).toFixed(0)}%` }))
    .sort((a, b) => parseFloat(b.factor.slice(1)) - parseFloat(a.factor.slice(1)));
  console.table(upliftRows);

  // Diagnóstico específico del algoritmo actual: ¿cuántos valores recientes quedan fuera de banda?
  console.log("\n=== Diagnóstico banda mu ± 0.5σ (ventana 18 meses, igual que el script real) ===");
  const dowNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const win = window18m(series);
  for (let dow = 0; dow < 7; dow++) {
    const vals = win.filter((h) => h.dow === dow);
    const v = vals.map((x) => x.venta);
    const mu = mean(v);
    const sd = stddev(v);
    const inside = vals.filter((x) => x.venta >= mu - 0.5 * sd && x.venta <= mu + 0.5 * sd);
    const last12 = vals.slice(-12);
    const last12Inside = last12.filter(
      (x) => x.venta >= mu - 0.5 * sd && x.venta <= mu + 0.5 * sd
    );
    const usados = inside.slice(-6);
    const antiguedad = usados.length
      ? Math.round((vals[vals.length - 1].ts - usados[0].ts) / 86400000)
      : 0;
    const baseActual = mean(usados.map((x) => x.venta));
    const media4 = mean(vals.slice(-4).map((x) => x.venta));
    console.log(
      `${dowNames[dow].padEnd(10)} | in-band: ${String(inside.length).padStart(3)}/${String(
        vals.length
      ).padStart(3)} (${((inside.length / vals.length) * 100).toFixed(0)}%)` +
        ` | últ.12 sem in-band: ${String(last12Inside.length).padStart(2)}/12` +
        ` | los 6 usados abarcan ${String(antiguedad).padStart(3)} días atrás` +
        ` | base actual: ${baseActual.toFixed(0).padStart(7)}` +
        ` vs media últ.4: ${media4.toFixed(0).padStart(7)}` +
        ` (${(((baseActual - media4) / media4) * 100).toFixed(0)}%)`
    );
  }

  // Estado real del mes en curso según la tabla Predicciones
  console.log("\n=== Mes en curso: tabla Predicciones vs alternativa ===");
  const pred = await runQuery(
    `SELECT Fecha, Ventas, VentasProyectadas
     FROM \`neat-chain-450900-a1.Ventas.Predicciones\`
     WHERE Anio = EXTRACT(YEAR FROM CURRENT_DATE('America/Lima'))
       AND Mes = EXTRACT(MONTH FROM CURRENT_DATE('America/Lima'))
     ORDER BY Fecha`
  );
  const obsBQ = pred.reduce((a, r) => a + (Number(r.Ventas) || 0), 0);
  const proyBQ = pred.reduce((a, r) => a + (Number(r.VentasProyectadas) || 0), 0);
  const diasProy = pred.filter((r) => (Number(r.VentasProyectadas) || 0) > 0).length;

  const lastDate = series[series.length - 1].date;
  const ym = lastDate.slice(0, 7);
  const first = toDate(`${ym}-01`);
  const monthEnd = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const targets: Date[] = [];
  for (let t = toDate(lastDate).getTime() + 86400000; t <= monthEnd.getTime(); t += 86400000) {
    targets.push(new Date(t));
  }
  const altPreds = holidayAwareFactory(series)(series, targets);
  const altTotal = altPreds.reduce((a, b) => a + b, 0);
  const observedReal = series
    .filter((s) => s.date.slice(0, 7) === ym)
    .reduce((a, b) => a + b.venta, 0);

  console.log(`Último día con datos en sales_df: ${lastDate}`);
  console.log(
    `Predicciones (BQ): observado ${obsBQ.toFixed(0)} + proyectado ${proyBQ.toFixed(
      0
    )} (${diasProy} días) = ${(obsBQ + proyBQ).toFixed(0)}`
  );
  console.log(
    `Alternativa H:     observado ${observedReal.toFixed(0)} + proyectado ${altTotal.toFixed(
      0
    )} (${targets.length} días) = ${(observedReal + altTotal).toFixed(0)}`
  );
  console.log(
    `Diferencia: ${(
      ((observedReal + altTotal - (obsBQ + proyBQ)) / (obsBQ + proyBQ)) *
      100
    ).toFixed(1)}%`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
