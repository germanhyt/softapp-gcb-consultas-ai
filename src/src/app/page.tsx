"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { DateFilter, DashboardFilters } from "@/components/dashboard/date-filter";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { NegocioTable } from "@/components/dashboard/negocio-table";
import { MediosPagoChart } from "@/components/dashboard/medios-pago-chart";
import { TrendCharts, ChartsData } from "@/components/dashboard/trend-charts";

export interface NegocioData {
  total: number;
  presupuesto?: number;
  canales: Record<string, number>;
  propinas?: number;
  medios_pago?: Record<string, number>;
}

interface MonthData {
  month: string;
  label: string;
  negocios: Record<string, NegocioData>;
  total: number;
  presupuesto?: number;
}

interface DashboardResponse {
  start_date: string;
  end_date: string;
  months: MonthData[];
  year_total: number;
  year_presupuesto?: number;
  year_propinas?: number;
  error?: string;
}

function defaultFilters(): DashboardFilters {
  const y = new Date().getFullYear();
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

export default function DashboardPage() {
  const [filters, setFilters]         = useState<DashboardFilters>(defaultFilters);
  const [turnos, setTurnos]           = useState<string[]>([]);
  const [negocioList, setNegocioList] = useState<string[]>([]);
  const [data, setData]               = useState<DashboardResponse | null>(null);
  const [chartsData, setChartsData]   = useState<ChartsData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // ── Fetch turnos + negocios once ─────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/turnos")
      .then((r) => r.json()).then((j) => setTurnos(j.turnos || [])).catch(() => {});
    fetch("/api/dashboard/negocios")
      .then((r) => r.json()).then((j) => setNegocioList(j.negocios || [])).catch(() => {});
  }, []);

  // ── Build shared query params ─────────────────────────────────────────────
  const buildParams = useCallback((f: DashboardFilters) => {
    const p = new URLSearchParams({ start_date: f.startDate, end_date: f.endDate });
    if (f.turno) p.set("turno", f.turno);
    if (f.diasSemana?.length) p.set("dias_semana", f.diasSemana.join(","));
    if (f.negocios?.length)   p.set("negocios", f.negocios.join(","));
    return p;
  }, []);

  // ── Fetch dashboard data + charts in parallel ─────────────────────────────
  const fetchData = useCallback(async (f: DashboardFilters) => {
    if (!f.startDate || !f.endDate || f.startDate > f.endDate) return;
    setLoading(true);
    setError(null);
    try {
      const params = buildParams(f);
      const [ventasRes, chartsRes] = await Promise.all([
        fetch(`/api/dashboard/ventas?${params}`),
        fetch(`/api/dashboard/charts?${params}`),
      ]);

      if (!ventasRes.ok) throw new Error(`Error ${ventasRes.status}`);
      const json: DashboardResponse = await ventasRes.json();
      if (json.error) throw new Error(json.error);
      setData(json);

      if (chartsRes.ok) {
        const charts = await chartsRes.json() as ChartsData;
        setChartsData(charts);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // ── Debounced re-fetch on filter change (500 ms) ─────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => fetchData(filters), 500);
    return () => clearTimeout(timer);
  }, [filters, fetchData]);

  // ── Aggregate display data from all months ───────────────────────────────
  const displayNegocios: Record<string, NegocioData> = (() => {
    if (!data) return {};
    const merged: Record<string, NegocioData> = {};
    for (const m of data.months) {
      for (const [neg, nd] of Object.entries(m.negocios)) {
        if (!merged[neg]) merged[neg] = { total: 0, canales: {} };
        merged[neg].total = Math.round((merged[neg].total + nd.total) * 100) / 100;
        if (nd.presupuesto) {
          merged[neg].presupuesto = Math.round(((merged[neg].presupuesto || 0) + nd.presupuesto) * 100) / 100;
        }
        for (const [canal, amount] of Object.entries(nd.canales || {})) {
          merged[neg].canales[canal] = Math.round(((merged[neg].canales[canal] || 0) + amount) * 100) / 100;
        }
        if (nd.propinas) {
          merged[neg].propinas = Math.round(((merged[neg].propinas || 0) + nd.propinas) * 100) / 100;
        }
        if (nd.medios_pago) {
          const mp = merged[neg].medios_pago || { efectivo: 0, tarjeta: 0, otros: 0 };
          merged[neg].medios_pago = {
            efectivo: Math.round((mp.efectivo + nd.medios_pago.efectivo) * 100) / 100,
            tarjeta:  Math.round((mp.tarjeta  + nd.medios_pago.tarjeta)  * 100) / 100,
            otros:    Math.round((mp.otros    + nd.medios_pago.otros)    * 100) / 100,
          };
        }
      }
    }
    return merged;
  })();

  const displayTotal       = data?.year_total       ?? 0;
  const displayPresupuesto = data?.year_presupuesto;
  const displayPropinas    = data?.year_propinas     ?? 0;
  const negocio_count      = Object.keys(displayNegocios).length;
  const hasData            = !!(data && data.months.length > 0);
  const showMonthly        = hasData && (data?.months.length ?? 0) > 1;

  const filterLabel = filters.startDate === filters.endDate
    ? filters.startDate
    : `${filters.startDate} → ${filters.endDate}`;

  const hasCharts = !!(chartsData && (
    chartsData.por_turno.length > 0 ||
    chartsData.por_dia.length > 0 ||
    chartsData.por_hora.length > 0
  ));

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
              Dashboard Cavas Reunidas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ventas consolidadas por negocio, canal y turno
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData(filters)}
          disabled={loading}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Filtros */}
      <DateFilter filters={filters} turnos={turnos} negocioList={negocioList} onChange={setFilters} />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          No se pudo cargar el dashboard: {error}
        </div>
      )}
      {!loading && !error && !hasData && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-10 text-center text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin datos para {filterLabel}</p>
        </div>
      )}

      {!loading && !error && hasData && (
        <>
          {/* KPIs */}
          <KpiCards
            total={displayTotal}
            presupuesto={displayPresupuesto}
            negocio_count={negocio_count}
            propinas={displayPropinas > 0 ? displayPropinas : undefined}
          />

          {/* Tendencia mensual */}
          {showMonthly && (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
                Tendencia Mensual — Ventas por Negocio
              </h3>
              <MonthlyChart months={data!.months} />
            </div>
          )}

          {/* ── Gráficos comparativos: Turno / Día / Hora ── */}
          {hasCharts && (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-900/60 p-4">
              <TrendCharts data={chartsData!} />
            </div>
          )}

          {/* Desglose por negocio / canal */}
          {negocio_count > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">
                {filters.viewMode === "medios_pago"
                  ? "Desglose por Negocio y Medio de Pago"
                  : "Desglose por Negocio y Canal"}
              </h3>
              <NegocioTable
                negocios={displayNegocios}
                grand_total={displayTotal}
                viewMode={filters.viewMode ?? "canales"}
              />
            </div>
          )}

          {/* Medios de pago chart — TOTEAT */}
          {(() => {
            const negsMedios = Object.entries(displayNegocios)
              .filter(([, d]) => d.medios_pago && Object.keys(d.medios_pago).length > 0)
              .map(([neg, d]) => ({ negocio: neg, medios_pago: d.medios_pago! }));
            if (!negsMedios.length) return null;
            return (
              <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
                  Medios de Pago por Negocio — Efectivo, Tarjeta, Otros (TOTEAT)
                </h3>
                <MediosPagoChart negocios={negsMedios} />
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
