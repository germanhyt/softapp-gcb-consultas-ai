"use client";

import { Fragment, useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Loader2, TrendingUp, Target, BarChart2, RefreshCw,
  Filter, Check, ChevronDown,
} from "lucide-react";
import { PlotlyChart } from "@/components/charts/PlotlyChart";
import { formatSoles } from "@/lib/config/column-rules";

// ── Color palette ────────────────────────────────────────────────────────────
const NEGOCIO_COLORS: Record<string, string> = {
  "Bar Refugio": "#059669", "Sisa Cafe": "#2563eb", "Limanesas": "#7c3aed",
  "Barrio Mancora": "#d97706", "Patio Cavenecia": "#dc2626", "Don Melchor": "#db2777",
  "Hanzo": "#0d9488", "Saltao": "#6366f1", "La 22": "#ea580c",
  "Bros": "#0891b2", "Anticuching": "#84cc16", "Choza de la Anaconda": "#f43f5e",
};
const PALETTE = ["#059669","#2563eb","#7c3aed","#d97706","#dc2626","#db2777",
  "#0d9488","#6366f1","#ea580c","#0891b2","#84cc16","#f43f5e","#14b8a6","#8b5cf6"];

function negocioColor(neg: string, idx: number): string {
  return NEGOCIO_COLORS[neg] ?? PALETTE[idx % PALETTE.length];
}

// ── Types ────────────────────────────────────────────────────────────────────
interface NegocioData {
  total: number;
  presupuesto?: number;
  canales: Record<string, number>;
}

interface MonthData {
  month: string;
  label: string;
  negocios: Record<string, NegocioData>;
  total: number;
  presupuesto?: number;
}

interface ApiResponse {
  months: MonthData[];
  year_total: number;
  year_presupuesto?: number;
  error?: string;
}

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Negocio filter dropdown ──────────────────────────────────────────────────
function NegocioFilter({
  negocios, selected, onChange,
}: {
  negocios: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isNone = selected.has("__none__");
  const allSelected = selected.size === 0 || selected.size === negocios.length;
  const label = isNone
    ? "Ningún negocio"
    : allSelected
    ? "Todos los negocios"
    : selected.size === 1
    ? [...selected][0]
    : `${selected.size} negocios`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border-2 font-semibold transition-colors
          border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200
          hover:bg-slate-50 dark:hover:bg-zinc-700"
      >
        <Filter className="h-3 w-3" />
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-80 overflow-y-auto
          rounded-xl border-2 border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-800
          shadow-xl text-xs">
          {/* Select all / None */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-zinc-700">
            <button
              onClick={() => onChange(new Set())}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >Todos</button>
            <button
              onClick={() => onChange(new Set(["__none__"]))}
              className="text-red-500 dark:text-red-400 font-semibold hover:underline"
            >Ninguno</button>
          </div>
          {negocios.map((neg) => {
            const isNone = selected.has("__none__");
            const active = !isNone && (selected.size === 0 || selected.has(neg));
            return (
              <button
                key={neg}
                onClick={() => {
                  // From "none" state → select just this one
                  if (isNone) { onChange(new Set([neg])); return; }
                  const next = new Set(selected.size === 0 ? negocios : selected);
                  if (next.has(neg)) next.delete(neg);
                  else next.add(neg);
                  next.delete("__none__");
                  // If all selected, clear to "all"
                  if (next.size === negocios.length || next.size === 0) onChange(new Set());
                  else onChange(next);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-700
                  ${active ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}
              >
                <div className={`flex h-4 w-4 items-center justify-center rounded border-2 shrink-0
                  ${active
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-300 dark:border-zinc-600"}`}
                >
                  {active && <Check className="h-3 w-3" />}
                </div>
                <span className="truncate">{neg}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ProyeccionesPage() {
  const curYear = new Date().getFullYear();
  const [year, setYear]           = useState(curYear);
  const [monthFrom, setMonthFrom] = useState(1);
  const [monthTo, setMonthTo]     = useState(12);
  const [data, setData]           = useState<ApiResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selectedNegs, setSelectedNegs] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (y: number, mFrom: number, mTo: number) => {
    setLoading(true); setError(null);
    const sd = `${y}-${String(mFrom).padStart(2, "0")}-01`;
    const lastDay = new Date(y, mTo, 0).getDate();
    const ed = `${y}-${String(mTo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    try {
      const res = await fetch(`/api/dashboard/ventas?start_date=${sd}&end_date=${ed}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json: ApiResponse = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(year, monthFrom, monthTo); }, [year, monthFrom, monthTo, fetchData]);

  // Reset negocio filter when year changes (month resets handled in changeYear)
  useEffect(() => { setSelectedNegs(new Set()); }, [year]);

  const changeYear = (y: number) => { setMonthFrom(1); setMonthTo(12); setYear(y); };

  // ── All negocios sorted by total ──────────────────────────────────────────
  const allNegocios = useMemo(() => {
    const months = data?.months ?? [];
    return Array.from(new Set(months.flatMap((m) => Object.keys(m.negocios))))
      .filter((neg) => {
        const total = (data?.months ?? []).reduce((s, m) => s + (m.negocios[neg]?.total || 0), 0);
        return total > 0;
      })
      .sort((a, b) => {
        const ta = (data?.months ?? []).reduce((s, m) => s + (m.negocios[a]?.total || 0), 0);
        const tb = (data?.months ?? []).reduce((s, m) => s + (m.negocios[b]?.total || 0), 0);
        return tb - ta;
      });
  }, [data]);

  // ── Filtered data ─────────────────────────────────────────────────────────
  const { months, negocios, totalVentas, totalPres, hasBudget } = useMemo(() => {
    const rawMonths = data?.months ?? [];
    const filter = selectedNegs.size > 0 ? selectedNegs : null;
    const negs = filter ? allNegocios.filter((n) => filter.has(n)) : allNegocios;

    const filteredMonths = rawMonths.map((m) => {
      if (!filter) return m;
      const filteredNegocios: Record<string, NegocioData> = {};
      let total = 0; let pres = 0;
      for (const neg of negs) {
        if (m.negocios[neg]) {
          filteredNegocios[neg] = m.negocios[neg];
          total += m.negocios[neg].total;
          pres += m.negocios[neg].presupuesto ?? 0;
        }
      }
      return { ...m, negocios: filteredNegocios, total: Math.round(total * 100) / 100, presupuesto: pres > 0 ? Math.round(pres * 100) / 100 : undefined };
    });

    const tv = filteredMonths.reduce((s, m) => s + m.total, 0);
    const tp = filteredMonths.reduce((s, m) => s + (m.presupuesto || 0), 0);
    return {
      months: filteredMonths,
      negocios: negs,
      totalVentas: Math.round(tv * 100) / 100,
      totalPres: Math.round(tp * 100) / 100,
      hasBudget: tp > 0,
    };
  }, [data, selectedNegs, allNegocios]);

  const cumpl = hasBudget ? (totalVentas / totalPres) * 100 : null;
  const delta = totalVentas - totalPres;

  const xLabels = months.map((m) => {
    const [, mo] = m.month.split("-").map(Number);
    return MONTHS_ES[(mo || 1) - 1];
  });

  // ── Charts ────────────────────────────────────────────────────────────────

  // Chart 1: Ventas vs Presupuesto total mensual
  const chart1Data = [
    {
      type: "bar", name: "Ventas Reales", x: xLabels,
      y: months.map((m) => m.total),
      marker: { color: "#059669" },
      text: months.map((m) => formatSoles(m.total)),
      textposition: "none",
      hovertemplate: "%{x}: %{text}<extra>Ventas</extra>",
    },
    ...(hasBudget ? [{
      type: "scatter", mode: "lines+markers", name: "Presupuesto", x: xLabels,
      y: months.map((m) => m.presupuesto ?? 0),
      line: { color: "#2563eb", width: 2.5, dash: "dot" },
      marker: { color: "#2563eb", size: 7 },
    }] : []),
  ];

  // Chart 2: Cumplimiento % por negocio (horizontal bars)
  const chart2Data = useMemo(() => {
    return negocios.map((neg, i) => {
      const ventas = months.reduce((s, m) => s + (m.negocios[neg]?.total || 0), 0);
      const pres   = months.reduce((s, m) => s + (m.negocios[neg]?.presupuesto || 0), 0);
      return { neg, ventas, pres, cumpl: pres > 0 ? Math.round((ventas / pres) * 1000) / 10 : null, color: negocioColor(neg, i) };
    }).filter((d) => d.pres > 0).sort((a, b) => (b.cumpl ?? 0) - (a.cumpl ?? 0));
  }, [months, negocios]);

  // Chart 3: Top negocios stacked bars
  const chart3Data = useMemo(() => {
    const topNegs = negocios.slice(0, 10);
    return topNegs.map((neg, i) => ({
      type: "bar", name: neg, x: xLabels,
      y: months.map((m) => m.negocios[neg]?.total || 0),
      marker: { color: negocioColor(neg, i) },
    }));
  }, [months, negocios, xLabels]);

  const commonLayout = (extra?: object) => ({
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor:  "rgba(0,0,0,0)",
    font: { family: "Inter, sans-serif", size: 12, color: "#1e293b" },
    margin: { t: 16, r: 16, l: 72, b: 40 },
    legend: { orientation: "h" as const, y: -0.22, font: { size: 10 } },
    xaxis: { gridcolor: "rgba(148,163,184,0.2)", zeroline: false, tickfont: { size: 12, color: "#374151" } },
    yaxis: { gridcolor: "rgba(148,163,184,0.2)", tickprefix: "S/ ", tickformat: ".2s", zeroline: false, tickfont: { size: 11, color: "#374151" } },
    ...extra,
  });

  const config = {
    displaylogo: false, responsive: true,
    modeBarButtonsToRemove: ["select2d" as const, "lasso2d" as const],
    toImageButtonOptions: { format: "png" as const, scale: 2 },
  };

  const years = [curYear - 1, curYear, curYear + 1];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">Proyecciones</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ventas reales vs presupuesto · {MONTHS_ES[monthFrom - 1]}–{MONTHS_ES[monthTo - 1]} {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Negocio filter */}
          {allNegocios.length > 0 && (
            <NegocioFilter negocios={allNegocios} selected={selectedNegs} onChange={setSelectedNegs} />
          )}
          {/* Month range */}
          <div className="flex items-center gap-1 text-xs">
            <select value={monthFrom} onChange={(e) => { const v = Number(e.target.value); setMonthFrom(v); if (v > monthTo) setMonthTo(v); }}
              className="px-2 py-1.5 rounded-lg border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-semibold"
            >
              {MONTHS_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <span className="text-slate-400 dark:text-slate-500">—</span>
            <select value={monthTo} onChange={(e) => { const v = Number(e.target.value); setMonthTo(v); if (v < monthFrom) setMonthFrom(v); }}
              className="px-2 py-1.5 rounded-lg border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-semibold"
            >
              {MONTHS_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          {/* Year selector */}
          <div className="flex items-center gap-1">
            {years.map((y) => (
              <button key={y} onClick={() => changeYear(y)}
                className={`text-xs px-3 py-1.5 rounded-lg border-2 font-bold transition-colors ${
                  year === y
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "border-slate-400 dark:border-zinc-500 text-slate-800 dark:text-slate-100 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700"
                }`}
              >{y}</button>
            ))}
          </div>
          <button onClick={() => fetchData(year, monthFrom, monthTo)} disabled={loading}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          Error: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Ventas Reales",
                value: formatSoles(totalVentas),
                sub: `${months.length} meses · ${negocios.length} negocios`,
                icon: TrendingUp,
                gradient: "from-emerald-600 to-emerald-700",
                bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700",
                text: "text-emerald-900 dark:text-emerald-100",
              },
              {
                label: "Presupuesto",
                value: hasBudget ? formatSoles(totalPres) : "Sin datos",
                sub: hasBudget ? `${year}` : `No hay presupuesto ${year}`,
                icon: Target,
                gradient: "from-blue-600 to-blue-700",
                bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700",
                text: "text-blue-900 dark:text-blue-100",
              },
              {
                label: "Cumplimiento",
                value: cumpl !== null ? `${cumpl.toFixed(1)}%` : "—",
                sub: hasBudget ? (cumpl! >= 100 ? "Meta alcanzada" : "Por debajo de meta") : "",
                icon: BarChart2,
                gradient: cumpl === null ? "from-slate-500 to-slate-600" :
                          cumpl >= 100 ? "from-emerald-600 to-emerald-700" :
                          cumpl >= 80  ? "from-blue-600 to-blue-700" :
                          cumpl >= 60  ? "from-amber-600 to-amber-700" : "from-red-600 to-red-700",
                bg: "bg-slate-50 dark:bg-zinc-800/60 border-slate-300 dark:border-zinc-600",
                text: "text-slate-900 dark:text-slate-100",
              },
              {
                label: "Diferencia",
                value: hasBudget ? formatSoles(Math.abs(delta)) : "—",
                sub: hasBudget ? (delta >= 0 ? "sobre presupuesto" : "bajo presupuesto") : "",
                icon: TrendingUp,
                gradient: !hasBudget ? "from-slate-500 to-slate-600" : delta >= 0 ? "from-emerald-600 to-emerald-700" : "from-red-600 to-red-700",
                bg: !hasBudget
                  ? "bg-slate-50 dark:bg-zinc-800/60 border-slate-300 dark:border-zinc-600"
                  : delta >= 0
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700"
                    : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700",
                text: !hasBudget ? "text-slate-900 dark:text-slate-100"
                  : delta >= 0 ? "text-emerald-900 dark:text-emerald-100" : "text-red-900 dark:text-red-100",
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className={`rounded-xl border-2 p-4 shadow-sm ${c.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${c.gradient} text-white shadow-sm`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{c.label}</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums leading-tight ${c.text}`}>{c.value}</p>
                  {c.sub && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{c.sub}</p>}
                </div>
              );
            })}
          </div>

          {/* Chart 1 — Ventas vs Presupuesto mensual */}
          {months.length > 0 && (
            <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Ventas Reales vs Presupuesto — {year}
              </h3>
              <PlotlyChart
                data={chart1Data}
                layout={{ ...commonLayout({ barmode: "group", height: 340 }), height: 340 }}
                config={config}
                style={{ width: "100%", height: 340 }}
                useResizeHandler
              />
            </div>
          )}

          {/* Chart 2 — Cumplimiento % por negocio */}
          {chart2Data.length > 0 && (
            <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-violet-600" />
                Cumplimiento Presupuestal por Negocio
              </h3>
              <PlotlyChart
                data={[{
                  type: "bar",
                  orientation: "h",
                  x: chart2Data.map((d) => d.cumpl),
                  y: chart2Data.map((d) => d.neg),
                  text: chart2Data.map((d) => `${d.cumpl?.toFixed(1)}%`),
                  textposition: "outside",
                  marker: {
                    color: chart2Data.map((d) =>
                      (d.cumpl ?? 0) >= 100 ? "#059669" : (d.cumpl ?? 0) >= 80 ? "#2563eb" : "#d97706"
                    ),
                  },
                  hovertemplate: "%{y}: %{x:.1f}%<extra></extra>",
                }]}
                layout={{
                  ...commonLayout(),
                  height: Math.max(200, chart2Data.length * 36 + 60),
                  xaxis: { gridcolor: "rgba(148,163,184,0.2)", zeroline: false, ticksuffix: "%", tickfont: { size: 12, color: "#374151" } },
                  yaxis: { gridcolor: "rgba(148,163,184,0.2)", zeroline: false, tickfont: { size: 11, color: "#1e293b", family: "Inter, sans-serif" }, autorange: "reversed" as const },
                  shapes: [{
                    type: "line", x0: 100, x1: 100, y0: -0.5, y1: chart2Data.length - 0.5,
                    line: { color: "#10b981", width: 2, dash: "dot" },
                  }],
                  margin: { t: 16, r: 60, l: 140, b: 40 },
                }}
                config={config}
                style={{ width: "100%", height: Math.max(200, chart2Data.length * 36 + 60) }}
                useResizeHandler
              />
            </div>
          )}

          {/* Chart 3 — Ventas por Negocio (stacked) */}
          {months.length > 0 && negocios.length > 1 && (
            <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4 text-blue-600" />
                Ventas por Negocio — Mensual {year}
              </h3>
              <PlotlyChart
                data={chart3Data}
                layout={{ ...commonLayout({ barmode: "stack", height: 340 }), height: 340 }}
                config={config}
                style={{ width: "100%", height: 340 }}
                useResizeHandler
              />
            </div>
          )}

          {/* Detail table — Ventas vs Presupuesto por negocio */}
          {negocios.length > 0 && (
            <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-700 overflow-x-auto shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b-2 border-slate-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 min-w-[140px]">Negocio</th>
                    <th className="text-left px-2 py-2.5 font-bold text-slate-500 dark:text-slate-400 min-w-[70px]"></th>
                    {months.map((m) => (
                      <th key={m.month} className="text-right px-3 py-2.5 font-bold text-slate-800 dark:text-slate-100 min-w-[100px]">
                        {MONTHS_ES[parseInt(m.month.slice(5, 7)) - 1]}
                      </th>
                    ))}
                    <th className="text-right px-4 py-2.5 font-bold text-slate-900 dark:text-white min-w-[110px]">Total</th>
                    {hasBudget && <th className="text-right px-4 py-2.5 font-bold text-slate-700 dark:text-slate-300 min-w-[60px]">%</th>}
                  </tr>
                </thead>
                <tbody>
                  {negocios.map((neg, i) => {
                    const negTotal = months.reduce((s, m) => s + (m.negocios[neg]?.total || 0), 0);
                    const negPres  = months.reduce((s, m) => s + (m.negocios[neg]?.presupuesto || 0), 0);
                    const negCumpl = negPres > 0 ? (negTotal / negPres) * 100 : null;
                    const c = negocioColor(neg, i);
                    if (negTotal === 0) return null;
                    return (
                      <Fragment key={neg}>
                        {/* Ventas row */}
                        <tr className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td rowSpan={negPres > 0 ? 3 : 1} className="px-4 py-2 font-semibold whitespace-nowrap align-top border-r border-slate-200 dark:border-zinc-700" style={{ color: c }}>{neg}</td>
                          <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400 font-medium">Ventas</td>
                          {months.map((m) => (
                            <td key={m.month} className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                              {(m.negocios[neg]?.total || 0) > 0 ? formatSoles(m.negocios[neg]!.total) : "—"}
                            </td>
                          ))}
                          <td className="px-4 py-1.5 text-right font-bold tabular-nums" style={{ color: c }}>{formatSoles(negTotal)}</td>
                          {hasBudget && (
                            <td rowSpan={negPres > 0 ? 3 : 1} className={`px-4 py-2 text-right tabular-nums font-bold align-middle border-l border-slate-200 dark:border-zinc-700 ${
                              negCumpl === null ? "text-slate-400" :
                              negCumpl >= 100 ? "text-emerald-600 dark:text-emerald-400" :
                              negCumpl >= 80 ? "text-blue-600 dark:text-blue-400" :
                              "text-amber-600 dark:text-amber-400"
                            }`}>
                              {negCumpl !== null ? `${negCumpl.toFixed(1)}%` : "—"}
                            </td>
                          )}
                        </tr>
                        {/* Presupuesto row */}
                        {negPres > 0 && (
                          <tr className="bg-blue-50/40 dark:bg-blue-950/10 border-b border-slate-100 dark:border-zinc-800">
                            <td className="px-2 py-1.5 text-blue-600 dark:text-blue-400 font-medium">Presup.</td>
                            {months.map((m) => (
                              <td key={m.month} className="px-3 py-1.5 text-right tabular-nums text-blue-600 dark:text-blue-400">
                                {(m.negocios[neg]?.presupuesto || 0) > 0 ? formatSoles(m.negocios[neg]!.presupuesto!) : "—"}
                              </td>
                            ))}
                            <td className="px-4 py-1.5 text-right tabular-nums font-semibold text-blue-700 dark:text-blue-400">{formatSoles(negPres)}</td>
                          </tr>
                        )}
                        {/* Diferencia row */}
                        {negPres > 0 && (
                          <tr className="border-b-2 border-slate-200 dark:border-zinc-700">
                            <td className="px-2 py-1.5 text-slate-400 dark:text-slate-500 font-medium">Dif.</td>
                            {months.map((m) => {
                              const v = m.negocios[neg]?.total || 0;
                              const p = m.negocios[neg]?.presupuesto || 0;
                              const diff = p > 0 ? v - p : 0;
                              return (
                                <td key={m.month} className={`px-3 py-1.5 text-right tabular-nums font-medium ${
                                  diff === 0 ? "text-slate-400" :
                                  diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                                }`}>
                                  {p > 0 ? (diff >= 0 ? "+" : "") + formatSoles(diff) : "—"}
                                </td>
                              );
                            })}
                            <td className={`px-4 py-1.5 text-right tabular-nums font-bold ${
                              negTotal - negPres >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                            }`}>
                              {(negTotal - negPres >= 0 ? "+" : "") + formatSoles(negTotal - negPres)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {/* Total rows */}
                  <tr className="bg-slate-100 dark:bg-zinc-800 border-t-2 border-slate-300 dark:border-zinc-600 font-bold">
                    <td rowSpan={hasBudget ? 3 : 1} className="px-4 py-2.5 text-slate-800 dark:text-slate-100 align-top border-r border-slate-300 dark:border-zinc-600">Total</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-300 font-medium">Ventas</td>
                    {months.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatSoles(m.total)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatSoles(totalVentas)}</td>
                    {hasBudget && (
                      <td rowSpan={3} className={`px-4 py-2 text-right tabular-nums font-bold align-middle border-l border-slate-300 dark:border-zinc-600 ${
                        (cumpl ?? 0) >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                      }`}>
                        {cumpl !== null ? `${cumpl.toFixed(1)}%` : "—"}
                      </td>
                    )}
                  </tr>
                  {hasBudget && (
                    <tr className="bg-blue-50/60 dark:bg-blue-950/20 font-bold">
                      <td className="px-2 py-2 text-blue-600 dark:text-blue-400 font-medium">Presup.</td>
                      {months.map((m) => (
                        <td key={m.month} className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400">
                          {formatSoles(m.presupuesto ?? 0)}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400">{formatSoles(totalPres)}</td>
                    </tr>
                  )}
                  {hasBudget && (
                    <tr className="bg-slate-100 dark:bg-zinc-800 font-bold border-t border-slate-300 dark:border-zinc-600">
                      <td className="px-2 py-2 text-slate-500 dark:text-slate-400 font-medium">Dif.</td>
                      {months.map((m) => {
                        const diff = m.total - (m.presupuesto ?? 0);
                        return (
                          <td key={m.month} className={`px-3 py-2 text-right tabular-nums ${
                            diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                          }`}>
                            {(diff >= 0 ? "+" : "") + formatSoles(diff)}
                          </td>
                        );
                      })}
                      <td className={`px-4 py-2 text-right tabular-nums ${
                        delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                      }`}>
                        {(delta >= 0 ? "+" : "") + formatSoles(delta)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
