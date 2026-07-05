"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { DateFilter, DashboardFilters } from "@/components/dashboard/date-filter";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { NegocioTable } from "@/components/dashboard/negocio-table";
import { MediosPagoChart } from "@/components/dashboard/medios-pago-chart";
import { TrendCharts, ChartsData } from "@/components/dashboard/trend-charts";
import { SalesPeriodTrend } from "@/components/dashboard/sales-period-trend";

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

// ── Styled Section Card ────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {title && (
        <h3
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--foreground-muted)" }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [filters, setFilters]         = useState<DashboardFilters>(defaultFilters);
  const [turnos, setTurnos]           = useState<string[]>([]);
  const [negocioList, setNegocioList] = useState<string[]>([]);
  const [data, setData]               = useState<DashboardResponse | null>(null);
  const [chartsData, setChartsData]   = useState<ChartsData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [hideNegociosSinVentas, setHideNegociosSinVentas] = useState(true);
  const persistHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/settings/dashboard")
      .then((r) => r.json())
      .then((j: { hideNegociosSinVentas?: boolean }) => {
        if (typeof j.hideNegociosSinVentas === "boolean") {
          setHideNegociosSinVentas(j.hideNegociosSinVentas);
        }
      })
      .catch(() => {});
  }, []);

  const persistHideNegocios = useCallback((value: boolean) => {
    if (persistHideTimerRef.current) clearTimeout(persistHideTimerRef.current);
    persistHideTimerRef.current = setTimeout(() => {
      fetch("/api/settings/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideNegociosSinVentas: value }),
      }).catch(() => {});
    }, 400);
  }, []);

  const onHideNegociosSinVentasChange = useCallback(
    (v: boolean) => {
      setHideNegociosSinVentas(v);
      persistHideNegocios(v);
    },
    [persistHideNegocios],
  );

  // ── Fetch turnos + negocios once ───────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/turnos")
      .then((r) => r.json()).then((j) => setTurnos(j.turnos || [])).catch(() => {});
    fetch("/api/dashboard/negocios")
      .then((r) => r.json()).then((j) => setNegocioList(j.negocios || [])).catch(() => {});
  }, []);

  const buildParams = useCallback((f: DashboardFilters) => {
    const p = new URLSearchParams({ start_date: f.startDate, end_date: f.endDate });
    if (f.turno) p.set("turno", f.turno);
    if (f.diasSemana?.length) p.set("dias_semana", f.diasSemana.join(","));
    if (f.negocios?.length)   p.set("negocios", f.negocios.join(","));
    return p;
  }, []);

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

  useEffect(() => {
    const timer = setTimeout(() => fetchData(filters), 500);
    return () => clearTimeout(timer);
  }, [filters, fetchData]);

  const displayNegociosRaw = useMemo(() => {
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
  }, [data]);

  const displayNegocios = useMemo(() => {
    if (!hideNegociosSinVentas) return displayNegociosRaw;
    return Object.fromEntries(
      Object.entries(displayNegociosRaw).filter(([, d]) => d.total > 0),
    );
  }, [displayNegociosRaw, hideNegociosSinVentas]);

  const monthsForChart = useMemo(() => {
    if (!data?.months.length) return [];
    if (!hideNegociosSinVentas) return data.months;
    const allowed = new Set(Object.keys(displayNegocios));
    return data.months.map((m) => {
      const negocios = Object.fromEntries(
        Object.entries(m.negocios).filter(([k]) => allowed.has(k)),
      );
      const total = Object.values(negocios).reduce((s, nd) => s + nd.total, 0);
      const presup = Object.values(negocios).reduce(
        (s, nd) => s + (nd.presupuesto || 0),
        0,
      );
      return {
        ...m,
        negocios,
        total: Math.round(total * 100) / 100,
        presupuesto:
          presup > 0 ? Math.round(presup * 100) / 100 : undefined,
      };
    });
  }, [data, hideNegociosSinVentas, displayNegocios]);

  const { displayTotal, displayPresupuesto, displayPropinas } = useMemo(() => {
    if (!data) {
      return {
        displayTotal: 0,
        displayPresupuesto: undefined as number | undefined,
        displayPropinas: 0,
      };
    }
    if (!hideNegociosSinVentas) {
      return {
        displayTotal: data.year_total,
        displayPresupuesto: data.year_presupuesto,
        displayPropinas: data.year_propinas ?? 0,
      };
    }
    let total = 0;
    let presupuesto = 0;
    let propinas = 0;
    for (const nd of Object.values(displayNegocios)) {
      total += nd.total;
      presupuesto += nd.presupuesto || 0;
      propinas += nd.propinas || 0;
    }
    return {
      displayTotal: Math.round(total * 100) / 100,
      displayPresupuesto:
        presupuesto > 0 ? Math.round(presupuesto * 100) / 100 : undefined,
      displayPropinas: propinas > 0 ? Math.round(propinas * 100) / 100 : 0,
    };
  }, [data, hideNegociosSinVentas, displayNegocios]);

  const negocio_count      = Object.keys(displayNegocios).length;
  const hasData            = !!(data && data.months.length > 0);
  const showMonthly        = hasData && (data?.months.length ?? 0) > 1;

  const filterLabel = filters.startDate === filters.endDate
    ? filters.startDate
    : `${filters.startDate} → ${filters.endDate}`;

  const hasPeriodTrend = !!(
    chartsData?.tendencia &&
    (chartsData.tendencia.por_dia.length > 0 ||
      chartsData.tendencia.por_semana.length > 0 ||
      chartsData.tendencia.por_mes.length > 0)
  );

  const hasCharts = !!(chartsData && (
    chartsData.por_turno.length > 0 ||
    chartsData.por_dia.length > 0 ||
    chartsData.por_hora.length > 0
  ));

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: "rgba(56,209,73,0.12)",
              border: "1px solid rgba(56,209,73,0.25)",
            }}
          >
            <BarChart3 className="h-5 w-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h2
              className="text-lg font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              Dashboard 
            </h2>
            <p
              className="text-xs"
              style={{ color: "var(--foreground-muted)" }}
            >
              Ventas consolidadas por negocio, canal y turno
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchData(filters)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 disabled:opacity-40 self-start sm:self-auto"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            color: "var(--foreground-muted)",
          }}
          onMouseEnter={e => {
            if (!loading) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--primary)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
            (e.currentTarget as HTMLElement).style.color = "var(--foreground-muted)";
          }}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <DateFilter
        filters={filters}
        turnos={turnos}
        negocioList={negocioList}
        onChange={setFilters}
        hideNegociosSinVentas={hideNegociosSinVentas}
        onHideNegociosSinVentasChange={onHideNegociosSinVentasChange}
      />

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--primary)" }} />
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: "rgba(214,84,84,0.08)",
            border: "1px solid rgba(214,84,84,0.25)",
            color: "var(--tertiary)",
          }}
        >
          No se pudo cargar el dashboard: {error}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && !error && !hasData && (
        <div
          className="rounded-xl p-10 text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" style={{ color: "var(--foreground-muted)" }} />
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            Sin datos para {filterLabel}
          </p>
        </div>
      )}

      {/* ── Data views ────────────────────────────────────────────────────── */}
      {!loading && !error && hasData && (
        <>
          <KpiCards
            total={displayTotal}
            presupuesto={displayPresupuesto}
            negocio_count={negocio_count}
            propinas={displayPropinas > 0 ? displayPropinas : undefined}
          />

          {hasPeriodTrend && chartsData?.tendencia && (
            <SectionCard title="Tendencia de Ventas">
              <SalesPeriodTrend data={chartsData.tendencia} />
            </SectionCard>
          )}

          {showMonthly && (
            <SectionCard title="Tendencia Mensual — Ventas por Negocio">
              <MonthlyChart months={monthsForChart} />
            </SectionCard>
          )}

          {hasCharts && (
            <SectionCard>
              <TrendCharts data={chartsData!} />
            </SectionCard>
          )}

          {negocio_count > 0 && (
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--foreground-muted)" }}
              >
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

          {(() => {
            const negsMedios = Object.entries(displayNegocios)
              .filter(([, d]) => d.medios_pago && Object.keys(d.medios_pago).length > 0)
              .map(([neg, d]) => ({ negocio: neg, medios_pago: d.medios_pago! }));
            if (!negsMedios.length) return null;
            return (
              <SectionCard title="Medios de Pago por Negocio — Efectivo, Tarjeta, Otros (TOTEAT)">
                <MediosPagoChart negocios={negsMedios} />
              </SectionCard>
            );
          })()}
        </>
      )}
    </div>
  );
}
