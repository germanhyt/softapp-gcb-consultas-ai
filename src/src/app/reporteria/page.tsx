"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, RefreshCw, FileText, Download } from "lucide-react";
import { DateFilter, DashboardFilters } from "@/components/dashboard/date-filter";
import { formatSoles } from "@/lib/config/column-rules";

// ── Types ────────────────────────────────────────────────────────────────────

interface NegocioData {
  total: number;
  canales: Record<string, number>;
  propinas?: number;
  medios_pago?: Record<string, number>;
  presupuesto?: number;
}

interface MonthData {
  month: string;
  label: string;
  negocios: Record<string, NegocioData>;
  total: number;
}

interface VentasResponse {
  start_date: string;
  end_date: string;
  months: MonthData[];
  year_total: number;
  year_presupuesto?: number;
  year_propinas?: number;
}

// ── Canal grouping (same as dashboard) ───────────────────────────────────────
const DELIVERY_CANALES = ["Rappi", "PedidosYa", "UberEats"];
const MEDIO_PAGO_LABELS: Record<string, string> = {
  efectivo:  "Efectivo",
  tarjeta:   "Tarjeta",
  otros:     "Otros",
  pago_link: "Pago Link",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultFilters(): DashboardFilters {
  const y = new Date().getFullYear();
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

function pct(part: number, total: number) {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "—";
}

// Group delivery sub-channels
function getDeliveryTotal(canales: Record<string, number>): number {
  return DELIVERY_CANALES.reduce((s, c) => s + (canales[c] ?? 0), 0);
}

function getNonDeliveryCanales(canales: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [c, v] of Object.entries(canales)) {
    if (!DELIVERY_CANALES.includes(c)) result[c] = v;
  }
  return result;
}

// ── Report types ─────────────────────────────────────────────────────────────

type ReportType = "negocio" | "medios_pago" | "canal";

const REPORT_TABS: { key: ReportType; label: string }[] = [
  { key: "negocio",    label: "Por Negocio" },
  { key: "canal",      label: "Por Canal" },
  { key: "medios_pago", label: "Medios de Pago" },
];

// ── Canal filter pills ───────────────────────────────────────────────────────
const CANAL_GROUPS = [
  { label: "Salón",         key: "salon",         match: (c: string) => ["Salón", "Patio"].includes(c) },
  { label: "Delivery",      key: "delivery",      match: (c: string) => DELIVERY_CANALES.includes(c) },
  { label: "Fidelio",       key: "fidelio",       match: (c: string) => c === "Fidelio" },
  { label: "Pago Link",     key: "pago_link",     match: (c: string) => c === "Pago Link" },
  { label: "Eventos",       key: "eventos",       match: (c: string) => c === "Eventos" },
  { label: "Llevar",        key: "llevar",        match: (c: string) => c === "Llevar" },
  { label: "Cuponatic",     key: "cuponatic",     match: (c: string) => c === "Cuponatic" },
  { label: "Bosque Mágico", key: "bosque_magico", match: (c: string) => c === "Bosque Mágico" },
];

// ── Report components ─────────────────────────────────────────────────────────

function ReportNegocio({ negocios, grand_total }: { negocios: Record<string, NegocioData>; grand_total: number }) {
  const list = Object.entries(negocios).sort(([, a], [, b]) => b.total - a.total);
  const hasPropinas = list.some(([, d]) => (d.propinas ?? 0) > 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Negocio</th>
            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Ventas Totales</th>
            {hasPropinas && <th className="text-right px-4 py-2.5 font-semibold text-pink-600 dark:text-pink-400 text-xs">Propinas</th>}
            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">% Participación</th>
          </tr>
        </thead>
        <tbody>
          {list.map(([neg, d]) => (
            <tr key={neg} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-100 text-sm">{neg}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatSoles(d.total)}
              </td>
              {hasPropinas && (
                <td className="px-4 py-2.5 text-right text-pink-600 dark:text-pink-400 tabular-nums text-xs">
                  {d.propinas ? formatSoles(d.propinas) : "—"}
                </td>
              )}
              <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 text-xs tabular-nums">
                {pct(d.total, grand_total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 dark:bg-zinc-800 font-bold border-t-2 border-slate-300 dark:border-zinc-600">
            <td className="px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100">Total Cavas Reunidas</td>
            <td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">{formatSoles(grand_total)}</td>
            {hasPropinas && (
              <td className="px-4 py-2.5 text-right text-pink-600 dark:text-pink-400 tabular-nums text-xs">
                {formatSoles(list.reduce((s, [, d]) => s + (d.propinas ?? 0), 0))}
              </td>
            )}
            <td className="px-4 py-2.5 text-right text-slate-500 text-xs">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ReportCanal({ negocios, grand_total }: { negocios: Record<string, NegocioData>; grand_total: number }) {
  // Aggregate all canales across negocios
  const canalTotals: Record<string, number> = {};
  const canalByNeg: Record<string, Record<string, number>> = {};

  for (const [neg, d] of Object.entries(negocios)) {
    canalByNeg[neg] = {};
    for (const [canal, amount] of Object.entries(d.canales)) {
      canalTotals[canal] = (canalTotals[canal] ?? 0) + amount;
      canalByNeg[neg][canal] = amount;
    }
    // Add delivery total
    const deliveryTotal = getDeliveryTotal(d.canales);
    if (deliveryTotal > 0) {
      canalTotals["Delivery (Total)"] = (canalTotals["Delivery (Total)"] ?? 0) + deliveryTotal;
    }
  }

  const negList = Object.keys(negocios).sort();
  const sortedCanales = Object.entries(canalTotals)
    .filter(([c]) => !DELIVERY_CANALES.includes(c))
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Canal</th>
            {negList.map((neg) => (
              <th key={neg} className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">{neg}</th>
            ))}
            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Total</th>
            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">%</th>
          </tr>
        </thead>
        <tbody>
          {sortedCanales.map(([canal, total]) => (
            <tr key={canal} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/30">
              <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 text-xs">{canal}</td>
              {negList.map((neg) => {
                const amount = canal === "Delivery (Total)"
                  ? getDeliveryTotal(negocios[neg]?.canales ?? {})
                  : (canalByNeg[neg]?.[canal] ?? 0);
                return (
                  <td key={neg} className="px-3 py-2 text-right tabular-nums text-xs text-slate-700 dark:text-slate-300">
                    {amount > 0 ? formatSoles(amount) : "—"}
                  </td>
                );
              })}
              <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {formatSoles(total)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-xs text-slate-500">{pct(total, grand_total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 dark:bg-zinc-800 font-bold border-t-2 border-slate-300 dark:border-zinc-600">
            <td className="px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100">Total</td>
            {negList.map((neg) => (
              <td key={neg} className="px-3 py-2.5 text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
                {formatSoles(negocios[neg]?.total ?? 0)}
              </td>
            ))}
            <td className="px-4 py-2.5 text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400">{formatSoles(grand_total)}</td>
            <td className="px-4 py-2.5 text-right text-xs text-slate-500">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ReportMediosPago({ negocios, grand_total }: { negocios: Record<string, NegocioData>; grand_total: number }) {
  const negList = Object.keys(negocios).sort();
  const mpKeys = Object.keys(MEDIO_PAGO_LABELS);

  // Aggregate medios pago totals
  const mpTotals: Record<string, number> = {};
  for (const d of Object.values(negocios)) {
    if (d.medios_pago) {
      for (const [k, v] of Object.entries(d.medios_pago)) {
        mpTotals[k] = (mpTotals[k] ?? 0) + v;
      }
    }
  }

  const mpTotal = mpKeys.reduce((s, k) => s + (mpTotals[k] ?? 0), 0);
  const hasData = mpTotal > 0;

  if (!hasData) return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
      Sin datos de medios de pago TOTEAT para el período seleccionado.<br />
      <span className="text-xs">Los medios de pago están disponibles solo para períodos de un mes.</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700">
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Medio de Pago</th>
              {negList.map((neg) => (
                <th key={neg} className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">{neg}</th>
              ))}
              <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Total</th>
              <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">% Participación</th>
            </tr>
          </thead>
          <tbody>
            {mpKeys.map((k) => {
              const total = mpTotals[k] ?? 0;
              if (total === 0) return null;
              return (
                <tr key={k} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 text-xs">{MEDIO_PAGO_LABELS[k]}</td>
                  {negList.map((neg) => {
                    const v = negocios[neg]?.medios_pago?.[k] ?? 0;
                    return (
                      <td key={neg} className="px-3 py-2.5 text-right tabular-nums text-xs text-slate-700 dark:text-slate-300">
                        {v > 0 ? formatSoles(v) : "—"}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatSoles(total)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-500">
                    {pct(total, mpTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 dark:bg-zinc-800 font-bold border-t-2 border-slate-300 dark:border-zinc-600">
              <td className="px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100">Total</td>
              {negList.map((neg) => {
                const negTotal = mpKeys.reduce((s, k) => s + (negocios[neg]?.medios_pago?.[k] ?? 0), 0);
                return (
                  <td key={neg} className="px-3 py-2.5 text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
                    {negTotal > 0 ? formatSoles(negTotal) : "—"}
                  </td>
                );
              })}
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400">{formatSoles(mpTotal)}</td>
              <td className="px-4 py-2.5 text-right text-xs text-slate-500">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Propinas separate */}
      {(() => {
        const propList = negList.map((neg) => ({ neg, propinas: negocios[neg]?.propinas ?? 0 })).filter((x) => x.propinas > 0);
        if (!propList.length) return null;
        const totalProp = propList.reduce((s, x) => s + x.propinas, 0);
        return (
          <div className="rounded-xl border border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/20 p-4">
            <h4 className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wide mb-3">Propinas (separadas de ventas)</h4>
            <div className="flex flex-wrap gap-4">
              {propList.map(({ neg, propinas }) => (
                <div key={neg}>
                  <p className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold uppercase">{neg}</p>
                  <p className="text-base font-bold text-pink-900 dark:text-pink-100">{formatSoles(propinas)}</p>
                </div>
              ))}
              <div className="ml-auto">
                <p className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold uppercase">Total Propinas</p>
                <p className="text-base font-bold text-pink-900 dark:text-pink-100">{formatSoles(totalProp)}</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReporteriaPage() {
  const [filters, setFilters]   = useState<DashboardFilters>(defaultFilters);
  const [turnos, setTurnos]     = useState<string[]>([]);
  const [negocioList, setNegocioList] = useState<string[]>([]);
  const [data, setData]         = useState<VentasResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>("negocio");
  const [canalFilter, setCanalFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/turnos").then((r) => r.json()).then((j) => setTurnos(j.turnos || [])).catch(() => {});
    fetch("/api/dashboard/negocios").then((r) => r.json()).then((j) => setNegocioList(j.negocios || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async (f: DashboardFilters) => {
    if (!f.startDate || !f.endDate || f.startDate > f.endDate) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start_date: f.startDate, end_date: f.endDate });
      if (f.turno) params.set("turno", f.turno);
      if (f.diasSemana?.length) params.set("dias_semana", f.diasSemana.join(","));
      if (f.negocios?.length) params.set("negocios", f.negocios.join(","));

      const res = await fetch(`/api/dashboard/ventas?${params}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as VentasResponse & { error?: string };
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchData(filters), 500);
    return () => clearTimeout(t);
  }, [filters, fetchData]);

  // Aggregate all months into display negocios
  const displayNegocios = useMemo<Record<string, NegocioData>>(() => {
    if (!data) return {};
    const merged: Record<string, NegocioData> = {};
    for (const m of data.months) {
      for (const [neg, nd] of Object.entries(m.negocios)) {
        if (!merged[neg]) merged[neg] = { total: 0, canales: {} };
        merged[neg].total = Math.round((merged[neg].total + nd.total) * 100) / 100;
        for (const [c, v] of Object.entries(nd.canales)) {
          merged[neg].canales[c] = Math.round(((merged[neg].canales[c] ?? 0) + v) * 100) / 100;
        }
        if (nd.propinas) merged[neg].propinas = Math.round(((merged[neg].propinas ?? 0) + nd.propinas) * 100) / 100;
        if (nd.medios_pago) {
          const mp = merged[neg].medios_pago ?? {};
          for (const [k, v] of Object.entries(nd.medios_pago)) {
            mp[k] = Math.round(((mp[k] ?? 0) + v) * 100) / 100;
          }
          merged[neg].medios_pago = mp;
        }
      }
    }
    return merged;
  }, [data]);

  // Apply canal filter
  const filteredNegocios = useMemo(() => {
    if (!canalFilter) return displayNegocios;
    const group = CANAL_GROUPS.find((g) => g.key === canalFilter);
    if (!group) return displayNegocios;
    const result: Record<string, NegocioData> = {};
    for (const [neg, nd] of Object.entries(displayNegocios)) {
      const filtCanales: Record<string, number> = {};
      for (const [c, v] of Object.entries(nd.canales)) {
        if (group.match(c)) filtCanales[c] = v;
      }
      const total = Object.values(filtCanales).reduce((s, v) => s + v, 0);
      if (total > 0) result[neg] = { ...nd, canales: filtCanales, total };
    }
    return result;
  }, [displayNegocios, canalFilter]);

  const displayTotal = Object.values(filteredNegocios).reduce((s, d) => s + d.total, 0);
  const displayPropinas = Object.values(filteredNegocios).reduce((s, d) => s + (d.propinas ?? 0), 0);
  const hasData = displayTotal > 0;

  const handleExport = () => {
    const rows: string[][] = [["Negocio", "Ventas Totales", "Propinas", "% Total"]];
    for (const [neg, d] of Object.entries(filteredNegocios).sort(([, a], [, b]) => b.total - a.total)) {
      rows.push([neg, d.total.toFixed(2), (d.propinas ?? 0).toFixed(2), pct(d.total, displayTotal)]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reporte_${filters.startDate}_${filters.endDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">Reportería</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Análisis por negocio, canal y medio de pago</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <button onClick={handleExport} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700">
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          )}
          <button onClick={() => fetchData(filters)} disabled={loading} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <DateFilter filters={filters} turnos={turnos} negocioList={negocioList} onChange={setFilters} />

      {/* Canal filter pills */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide self-center">Canal:</span>
        <button
          onClick={() => setCanalFilter(null)}
          className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-colors ${
            !canalFilter
              ? "bg-emerald-600 text-white border-emerald-600"
              : "border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700"
          }`}
        >Todos</button>
        {CANAL_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setCanalFilter(canalFilter === g.key ? null : g.key)}
            className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-colors ${
              canalFilter === g.key
                ? "bg-violet-600 text-white border-violet-600"
                : "border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700"
            }`}
          >{g.label}</button>
        ))}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          No se pudo cargar el reporte: {error}
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-10 text-center text-slate-500 dark:text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin datos para el período y filtros seleccionados</p>
        </div>
      )}

      {!loading && !error && hasData && (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Ventas Totales",    value: formatSoles(displayTotal),       border: "border-emerald-300 dark:border-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-900 dark:text-emerald-100" },
              { label: "Negocios",          value: String(Object.keys(filteredNegocios).length), border: "border-blue-300 dark:border-blue-700", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-900 dark:text-blue-100" },
              { label: "Propinas",          value: displayPropinas > 0 ? formatSoles(displayPropinas) : "—", border: "border-pink-300 dark:border-pink-700", bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-900 dark:text-pink-100" },
              { label: "Meses en período",  value: String(data?.months.length ?? 0), border: "border-slate-300 dark:border-zinc-600", bg: "bg-slate-50 dark:bg-zinc-800/60", text: "text-slate-900 dark:text-slate-100" },
            ].map((c) => (
              <div key={c.label} className={`rounded-xl border-2 p-4 shadow-sm ${c.border} ${c.bg}`}>
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className={`text-xl font-bold tabular-nums leading-tight ${c.text}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Report type tabs */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-zinc-700">
            {REPORT_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setReportType(key)}
                className={`px-4 py-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
                  reportType === key
                    ? "border-violet-600 text-violet-700 dark:text-violet-400"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Report content */}
          <div>
            {reportType === "negocio" && (
              <ReportNegocio negocios={filteredNegocios} grand_total={displayTotal} />
            )}
            {reportType === "canal" && (
              <ReportCanal negocios={filteredNegocios} grand_total={displayTotal} />
            )}
            {reportType === "medios_pago" && (
              <ReportMediosPago negocios={filteredNegocios} grand_total={displayTotal} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
