"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CalendarDays, TrendingUp } from "lucide-react";

export interface PeriodPoint {
  periodo: string;
  label: string;
  total: number;
  transacciones: number;
}

export interface SalesTrendData {
  por_dia: PeriodPoint[];
  por_semana: PeriodPoint[];
  por_mes: PeriodPoint[];
}

type PeriodMode = "dia" | "semana" | "mes";
type ChartMode = "bar" | "line";
type Metric = "total" | "transacciones";

const MODE_LABELS: Record<PeriodMode, string> = {
  dia: "Día",
  semana: "Semana (lun–dom)",
  mes: "Mes",
};

function fmtSoles(v: number) {
  if (v >= 1_000_000) return `S/${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `S/${(v / 1_000).toFixed(1)}K`;
  return `S/${v.toFixed(0)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  metric: Metric;
}) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl px-3 py-2 text-xs">
      <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">{label}</p>
      <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
        {metric === "total"
          ? `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
          : `${v.toLocaleString("es-PE")} transacciones`}
      </p>
    </div>
  );
}

interface SalesPeriodTrendProps {
  data: SalesTrendData;
}

export function SalesPeriodTrend({ data }: SalesPeriodTrendProps) {
  const [period, setPeriod] = useState<PeriodMode>("dia");
  const [mode, setMode] = useState<ChartMode>("line");
  const [metric, setMetric] = useState<Metric>("total");

  const series =
    period === "dia" ? data.por_dia : period === "semana" ? data.por_semana : data.por_mes;

  const btnBase = "text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-colors";
  const btnOff =
    `${btnBase} border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-slate-200 ` +
    "bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700";
  const btnOnEmerald = `${btnBase} bg-emerald-600 text-white border-emerald-600 shadow-sm`;
  const btnOnBlue = `${btnBase} bg-blue-600 text-white border-blue-600 shadow-sm`;
  const btnOnViolet = `${btnBase} bg-violet-600 text-white border-violet-600 shadow-sm`;

  const yFmt =
    metric === "total"
      ? (v: number) => fmtSoles(v)
      : (v: number) => v.toLocaleString("es-PE");

  const commonAxis = {
    tick: { fontSize: 10, fill: "#64748b", fontWeight: 600 },
    axisLine: false,
    tickLine: false,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
            Tendencia de ventas
          </span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {(Object.keys(MODE_LABELS) as PeriodMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={period === key ? btnOnEmerald : btnOff}
            >
              {MODE_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700 hidden sm:block" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("line")}
            className={mode === "line" ? btnOnBlue : btnOff}
          >
            Línea
          </button>
          <button
            type="button"
            onClick={() => setMode("bar")}
            className={mode === "bar" ? btnOnBlue : btnOff}
          >
            Barras
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMetric("total")}
            className={metric === "total" ? btnOnViolet : btnOff}
          >
            S/ Ventas
          </button>
          <button
            type="button"
            onClick={() => setMetric("transacciones")}
            className={metric === "transacciones" ? btnOnViolet : btnOff}
          >
            # Trans.
          </button>
        </div>
      </div>

      {!series.length ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
          Sin datos de tendencia para el período y filtros seleccionados
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          {mode === "bar" ? (
            <BarChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="label" {...commonAxis} interval="preserveStartEnd" />
              <YAxis tickFormatter={yFmt} {...commonAxis} width={56} />
              <Tooltip content={(p) => <CustomTooltip {...p} metric={metric} />} />
              <Bar dataKey={metric} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          ) : (
            <LineChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="label" {...commonAxis} interval="preserveStartEnd" />
              <YAxis tickFormatter={yFmt} {...commonAxis} width={56} />
              <Tooltip content={(p) => <CustomTooltip {...p} metric={metric} />} />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ fill: "#10b981", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}

      <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
        <CalendarDays className="h-3 w-3" />
        Semana agrupada de lunes a domingo según el rango del filtro principal
      </p>
    </div>
  );
}
