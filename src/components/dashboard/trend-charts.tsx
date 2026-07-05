"use client";

import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { BarChart2, TrendingUp, Clock, Sun, AlignLeft } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TurnoPoint { turno: string; total: number; transacciones: number }
interface DiaPoint   { dia_num: number; dia_label: string; total: number; transacciones: number }
interface HoraPoint  { hora: number; hora_label: string; total: number; transacciones: number }

export interface ChartsData {
  por_turno: TurnoPoint[];
  por_dia:   DiaPoint[];
  por_hora:  HoraPoint[];
  tendencia?: {
    por_dia: Array<{ periodo: string; label: string; total: number; transacciones: number }>;
    por_semana: Array<{ periodo: string; label: string; total: number; transacciones: number }>;
    por_mes: Array<{ periodo: string; label: string; total: number; transacciones: number }>;
  };
}

type ChartMode = "bar" | "line";
type Metric    = "total" | "transacciones";

// ── Palette ───────────────────────────────────────────────────────────────────
const TURNO_COLORS: Record<string, string> = {
  manana: "#f59e0b",
  "mañana": "#f59e0b",
  tarde: "#10b981",
  noche: "#6366f1",
  "turno dia": "#10b981",
  "turno día": "#10b981",
  "turno noche": "#6366f1",
  desayuno: "#f59e0b", breakfast: "#f59e0b",
  almuerzo: "#10b981", lunch:     "#10b981",
  cena:     "#6366f1", dinner:    "#6366f1",
  "sin turno": "#94a3b8",
};
function turnoColor(t: string) {
  return TURNO_COLORS[t.toLowerCase()] ?? "#64748b";
}

const DIA_COLORS = ["#94a3b8","#10b981","#10b981","#10b981","#10b981","#10b981","#f59e0b"];
// index matches dia_num 1=Dom(gray) 2-6=Mon-Fri(green) 7=Sat(amber)

function horaColor(h: number): string {
  if (h >= 6  && h < 11) return "#f59e0b";  // mañana — amber
  if (h >= 11 && h < 15) return "#10b981";  // almuerzo — green
  if (h >= 15 && h < 19) return "#3b82f6";  // tarde — blue
  return "#6366f1";                          // noche — violet
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtSoles(v: number) {
  if (v >= 1_000_000) return `S/${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `S/${(v / 1_000).toFixed(1)}K`;
  return `S/${v.toFixed(0)}`;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, metric }: {
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
        {metric === "total" ? `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2 })}` : `${v.toLocaleString("es-PE")} transacciones`}
      </p>
    </div>
  );
}

// ── Single chart panel ────────────────────────────────────────────────────────
interface ChartPanelProps<T> {
  title: string;
  icon: React.ReactNode;
  data: T[];
  xKey: keyof T;
  valueKey: keyof T;
  metric: Metric;
  mode: ChartMode;
  getColor?: (d: T, i: number) => string;
  emptyMsg?: string;
}

function ChartPanel<T>({
  title, icon, data, xKey, valueKey, metric, mode, getColor, emptyMsg
}: ChartPanelProps<T>) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">{emptyMsg ?? "Sin datos"}</p>
      </div>
    );
  }

  const yFmt = metric === "total"
    ? (v: number) => fmtSoles(v)
    : (v: number) => v.toLocaleString("es-PE");

  const commonAxis = {
    tick:  { fontSize: 11, fill: "#64748b", fontWeight: 600 },
    axisLine: false, tickLine: false,
  };

  const chartContent = mode === "bar" ? (
    <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
      <XAxis dataKey={xKey as string} {...commonAxis} />
      <YAxis tickFormatter={yFmt} {...commonAxis} width={52} />
      <Tooltip content={(p) => <CustomTooltip {...p} metric={metric} />} />
      <Bar dataKey={valueKey as string} radius={[4, 4, 0, 0]} maxBarSize={56}>
        {data.map((d, i) => (
          <Cell key={i} fill={getColor ? getColor(d, i) : "#10b981"} />
        ))}
      </Bar>
    </BarChart>
  ) : (
    <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
      <XAxis dataKey={xKey as string} {...commonAxis} />
      <YAxis tickFormatter={yFmt} {...commonAxis} width={52} />
      <Tooltip content={(p) => <CustomTooltip {...p} metric={metric} />} />
      <Line
        type="monotone"
        dataKey={valueKey as string}
        stroke="#10b981"
        strokeWidth={2.5}
        dot={{ fill: "#10b981", r: 4 }}
        activeDot={{ r: 6 }}
      />
    </LineChart>
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        {chartContent}
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface TrendChartsProps {
  data: ChartsData;
}

export function TrendCharts({ data }: TrendChartsProps) {
  const [mode, setMode]     = useState<ChartMode>("bar");
  const [metric, setMetric] = useState<Metric>("total");

  const btnBase = "text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-colors";
  const btnOff  = `${btnBase} border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700`;
  const btnOn   = (c: string) => `${btnBase} bg-${c}-600 text-white border-${c}-600 shadow-sm`;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Comparativas:</span>

        {/* Chart type */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("bar")}
            className={mode === "bar" ? btnOn("emerald") : btnOff}
            title="Barras"
          >
            <BarChart2 className="h-3.5 w-3.5 inline" />
            <span className="ml-1 hidden sm:inline">Barras</span>
          </button>
          <button
            onClick={() => setMode("line")}
            className={mode === "line" ? btnOn("blue") : btnOff}
            title="Línea"
          >
            <TrendingUp className="h-3.5 w-3.5 inline" />
            <span className="ml-1 hidden sm:inline">Línea</span>
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-zinc-700" />

        {/* Metric */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMetric("total")}
            className={metric === "total" ? btnOn("violet") : btnOff}
          >S/ Ventas</button>
          <button
            onClick={() => setMetric("transacciones")}
            className={metric === "transacciones" ? btnOn("violet") : btnOff}
          ># Trans.</button>
        </div>
      </div>

      {/* 3 charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Por Turno */}
        <ChartPanel
          title="Ventas por Turno"
          icon={<Sun className="h-4 w-4 text-amber-500" />}
          data={data.por_turno}
          xKey="turno"
          valueKey={metric}
          metric={metric}
          mode={mode}
          getColor={(d) => turnoColor(d.turno)}
          emptyMsg="Sin datos de turno en el período"
        />

        {/* Por Día */}
        <ChartPanel
          title="Ventas por Día de la Semana"
          icon={<AlignLeft className="h-4 w-4 text-blue-500" />}
          data={data.por_dia}
          xKey="dia_label"
          valueKey={metric}
          metric={metric}
          mode={mode}
          getColor={(d) => DIA_COLORS[(d.dia_num - 1) % 7] ?? "#10b981"}
          emptyMsg="Sin datos de días"
        />

        {/* Por Hora */}
        <ChartPanel
          title="Ventas por Hora del Día"
          icon={<Clock className="h-4 w-4 text-violet-500" />}
          data={data.por_hora}
          xKey="hora_label"
          valueKey={metric}
          metric={metric}
          mode={mode}
          getColor={(d) => horaColor(d.hora)}
          emptyMsg="Sin datos de hora en el período"
        />
      </div>
    </div>
  );
}
