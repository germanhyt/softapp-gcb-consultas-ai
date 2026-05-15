"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2, AlertCircle, ShieldCheck, ArrowLeft,
  CheckCircle2, XCircle, AlertTriangle, TrendingUp,
  Users, Cpu, CalendarDays,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DailySummary {
  id: number;
  date: string;
  toteat_total: number;
  toteat_conciliated: number;
  toteat_pending: number;
  payment_total: number;
  payment_matched: number;
  difference: number;
  surplus: number;   // sobrantes
  shortage: number;  // faltantes
  tips?: number;
  status?: string;
  propinas?: number;
}

interface MonthlyOverview {
  total_ventas?: number;
  total_conciliado?: number;
  total_diferencia?: number;
  cuadre_pct?: number;
  pago_link_cuadre_pct?: number;
  dias_cuadrados?: number;
  dias_totales?: number;
}

interface MethodStat {
  method: string;
  matched: number;
  total: number;
  pct: number;
}

interface AuditoriaData {
  instancia_id: number;
  daily_summaries: DailySummary[];
  monthly_overview: MonthlyOverview | null;
  method_stats: MethodStat[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(str: string) {
  try {
    const d = new Date(str + "T00:00:00");
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return str; }
}

function fmtNum(n: number | undefined | null, decimals = 0) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtSoles(n: number | undefined | null) {
  if (n === undefined || n === null) return "—";
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | undefined | null) {
  if (n === undefined || n === null) return "—";
  return `${n.toFixed(1)}%`;
}

function PctBar({ pct, color = "emerald" }: { pct: number; color?: string }) {
  const val = Math.min(Math.max(pct, 0), 100);
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500", blue: "bg-blue-500",
    amber: "bg-amber-500", red: "bg-red-500", violet: "bg-violet-500",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorMap[color] ?? colorMap.emerald}`} style={{ width: `${val}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-12 text-right text-slate-700 dark:text-slate-200">
        {fmtPct(val)}
      </span>
    </div>
  );
}

function StatusBadge({ status, diferencia }: { status?: string; diferencia?: number }) {
  if (status) {
    const map: Record<string, { label: string; cls: string }> = {
      cuadrado: { label: "Cuadrado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
      diferencia: { label: "Con Diferencia", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    };
    const c = map[status.toLowerCase()] ?? { label: status, cls: "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-slate-300" };
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
  }
  if (diferencia !== undefined) {
    const abs = Math.abs(diferencia);
    if (abs < 0.5) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Cuadrado</span>;
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Diferencia</span>;
  }
  return null;
}

// ── Section components ───────────────────────────────────────────────────────

function DailyTable({ summaries }: { summaries: DailySummary[] }) {
  const sorted = [...summaries].sort((a, b) => a.date.localeCompare(b.date));
  const hasPropinas = sorted.some((d) => (d.tips ?? d.propinas ?? 0) > 0);

  if (!sorted.length) return (
    <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">Sin datos diarios para esta instancia</div>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700">
            <th className="text-left px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Fecha</th>
            <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Ventas</th>
            <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Conciliado</th>
            <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Diferencia</th>
            <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Sobrante</th>
            <th className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Faltante</th>
            {hasPropinas && <th className="text-right px-3 py-2.5 font-semibold text-pink-600 dark:text-pink-400 text-xs">Propinas</th>}
            <th className="text-center px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Estado</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => {
            const diff = d.difference ?? (d.toteat_conciliated - d.payment_matched);
            const propinas = d.tips ?? d.propinas ?? 0;
            const isOk = Math.abs(diff) < 0.5;
            return (
              <tr
                key={d.id ?? d.date}
                className={`border-b border-slate-100 dark:border-zinc-800 ${
                  isOk ? "" : "bg-amber-50/40 dark:bg-amber-950/10"
                }`}
              >
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium text-xs whitespace-nowrap">
                  {fmtDate(d.date)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-700 dark:text-slate-300">
                  {fmtNum(d.toteat_total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  {fmtNum(d.toteat_conciliated)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums text-xs font-semibold ${
                  isOk ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                }`}>
                  {diff === 0 ? "0" : fmtNum(diff)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-blue-700 dark:text-blue-400">
                  {d.surplus ? fmtNum(d.surplus) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-red-600 dark:text-red-400">
                  {d.shortage ? fmtNum(d.shortage) : "—"}
                </td>
                {hasPropinas && (
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-pink-600 dark:text-pink-400">
                    {propinas > 0 ? fmtNum(propinas) : "—"}
                  </td>
                )}
                <td className="px-3 py-2 text-center">
                  <StatusBadge diferencia={diff} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 dark:bg-zinc-800 font-semibold border-t-2 border-slate-300 dark:border-zinc-600">
            <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">Totales</td>
            <td className="px-3 py-2 text-right tabular-nums text-xs">
              {fmtNum(sorted.reduce((s, d) => s + (d.toteat_total ?? 0), 0))}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
              {fmtNum(sorted.reduce((s, d) => s + (d.toteat_conciliated ?? 0), 0))}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-xs text-amber-700 dark:text-amber-400">
              {fmtNum(sorted.reduce((s, d) => s + (d.difference ?? 0), 0))}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-xs text-blue-700 dark:text-blue-400">
              {fmtNum(sorted.reduce((s, d) => s + (d.surplus ?? 0), 0))}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-xs text-red-600 dark:text-red-400">
              {fmtNum(sorted.reduce((s, d) => s + (d.shortage ?? 0), 0))}
            </td>
            {hasPropinas && (
              <td className="px-3 py-2 text-right tabular-nums text-xs text-pink-600 dark:text-pink-400">
                {fmtNum(sorted.reduce((s, d) => s + (d.tips ?? d.propinas ?? 0), 0))}
              </td>
            )}
            <td className="px-3 py-2 text-center text-xs text-slate-500">
              {sorted.filter((d) => Math.abs(d.difference ?? 0) < 0.5).length}/{sorted.length} días
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MethodStatsTable({ stats }: { stats: MethodStat[] }) {
  const sorted = [...stats].sort((a, b) => b.matched - a.matched);
  if (!sorted.length) return (
    <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">Sin datos de algoritmos</div>
  );

  const total = sorted.reduce((s, m) => s + m.matched, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Algoritmo</th>
            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">Conciliadas</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs min-w-[160px]">Efectividad</th>
            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 text-xs">% del Total</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.method} className="border-b border-slate-100 dark:border-zinc-800">
              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 text-xs">
                {m.method}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                {fmtNum(m.matched)}
              </td>
              <td className="px-4 py-2.5">
                <PctBar pct={m.pct ?? 0} color={m.pct >= 90 ? "emerald" : m.pct >= 70 ? "blue" : "amber"} />
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-500 dark:text-slate-400">
                {total > 0 ? fmtPct((m.matched / total) * 100) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 dark:bg-zinc-800 font-semibold border-t-2 border-slate-300 dark:border-zinc-600">
            <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-200">Total</td>
            <td className="px-4 py-2 text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
              {fmtNum(total)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Main content (needs Suspense for useSearchParams) ────────────────────────

function AuditoriaContent() {
  const sp = useSearchParams();
  const instanceId = sp.get("instancia");
  const mes = sp.get("mes"); // YYYY-MM

  const [data, setData]       = useState<AuditoriaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dias" | "mensual" | "algoritmos">("dias");

  useEffect(() => {
    if (!instanceId) { setLoading(false); return; }
    fetch(`/api/auditoria?instancia=${instanceId}`)
      .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json(); })
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [instanceId]);

  // ── Compute derived stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return null;
    const days = data.daily_summaries;
    const totalVentas     = days.reduce((s, d) => s + (d.toteat_total ?? 0), 0);
    const totalConciliado = days.reduce((s, d) => s + (d.toteat_conciliated ?? 0), 0);
    const totalDiff       = days.reduce((s, d) => s + (d.difference ?? 0), 0);
    const totalSobrante   = days.reduce((s, d) => s + (d.surplus ?? 0), 0);
    const totalFaltante   = days.reduce((s, d) => s + (d.shortage ?? 0), 0);
    const totalPropinas   = days.reduce((s, d) => s + (d.tips ?? d.propinas ?? 0), 0);
    const diasCuadrados   = days.filter((d) => Math.abs(d.difference ?? 0) < 0.5).length;
    const cuadrePct       = days.length > 0 ? (diasCuadrados / days.length) * 100 : 0;
    return { totalVentas, totalConciliado, totalDiff, totalSobrante, totalFaltante, totalPropinas, diasCuadrados, diasTotales: days.length, cuadrePct };
  }, [data]);

  const mesLabel = useMemo(() => {
    if (!mes) return "";
    const [y, m] = mes.split("-").map(Number);
    const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return `${MONTHS[(m || 1) - 1]} ${y}`;
  }, [mes]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!instanceId) return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-6 text-sm text-amber-800 dark:text-amber-300">
      Selecciona una instancia desde la página de{" "}
      <Link href="/instancias" className="underline font-semibold">Instancias</Link>.
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {error}
    </div>
  );

  const TABS = [
    { key: "dias",       label: "Cuadres por Día",   icon: CalendarDays },
    { key: "mensual",    label: "Resumen Mensual",    icon: TrendingUp },
    { key: "algoritmos", label: "Por Algoritmo",      icon: Cpu },
  ] as const;

  return (
    <div className="space-y-5">

      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link
          href="/instancias"
          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Instancias
        </Link>
        <span className="text-slate-300 dark:text-zinc-600">/</span>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{mesLabel || `Instancia #${instanceId}`}</span>
      </div>

      {/* KPI summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Ventas",         value: fmtNum(stats.totalVentas),     sub: "transacciones",  border: "border-slate-300 dark:border-zinc-600",       bg: "bg-slate-50 dark:bg-zinc-800/60",          text: "text-slate-900 dark:text-slate-100" },
            { label: "Conciliado",     value: fmtNum(stats.totalConciliado), sub: "transacciones",  border: "border-emerald-300 dark:border-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/40",     text: "text-emerald-900 dark:text-emerald-100" },
            { label: "Diferencia",     value: fmtNum(stats.totalDiff),       sub: "neta",           border: "border-amber-300 dark:border-amber-700",     bg: "bg-amber-50 dark:bg-amber-950/40",         text: "text-amber-900 dark:text-amber-100" },
            { label: "Sobrantes",      value: fmtNum(stats.totalSobrante),   sub: "transacciones",  border: "border-blue-300 dark:border-blue-700",       bg: "bg-blue-50 dark:bg-blue-950/40",           text: "text-blue-900 dark:text-blue-100" },
            { label: "Faltantes",      value: fmtNum(stats.totalFaltante),   sub: "transacciones",  border: "border-red-300 dark:border-red-700",         bg: "bg-red-50 dark:bg-red-950/40",             text: "text-red-900 dark:text-red-100" },
            { label: `% Cuadre`,       value: fmtPct(stats.cuadrePct),       sub: `${stats.diasCuadrados}/${stats.diasTotales} días`, border: stats.cuadrePct >= 90 ? "border-emerald-300 dark:border-emerald-700" : "border-amber-300 dark:border-amber-700", bg: stats.cuadrePct >= 90 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-amber-50 dark:bg-amber-950/40", text: stats.cuadrePct >= 90 ? "text-emerald-900 dark:text-emerald-100" : "text-amber-900 dark:text-amber-100" },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl border-2 p-3 shadow-sm ${c.border} ${c.bg}`}>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">{c.label}</p>
              <p className={`text-xl font-bold tabular-nums leading-tight ${c.text}`}>{c.value}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Monthly overview KPIs (from API if available) */}
      {data?.monthly_overview && (() => {
        const mo = data.monthly_overview!;
        const hasMo = Object.values(mo).some((v) => v !== undefined && v !== null);
        if (!hasMo) return null;
        return (
          <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 p-4">
            <h3 className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Resumen del Mes (TOTEAT)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {mo.total_ventas != null && (
                <div>
                  <p className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold uppercase">Total Ventas</p>
                  <p className="text-base font-bold text-violet-900 dark:text-violet-100">{fmtNum(mo.total_ventas)}</p>
                </div>
              )}
              {mo.total_conciliado != null && (
                <div>
                  <p className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold uppercase">Conciliado</p>
                  <p className="text-base font-bold text-violet-900 dark:text-violet-100">{fmtNum(mo.total_conciliado)}</p>
                </div>
              )}
              {mo.cuadre_pct != null && (
                <div>
                  <p className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold uppercase">% Cuadre mes</p>
                  <p className="text-base font-bold text-violet-900 dark:text-violet-100">{fmtPct(mo.cuadre_pct)}</p>
                </div>
              )}
              {mo.pago_link_cuadre_pct != null && (
                <div>
                  <p className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold uppercase">% Cuadre Pago Link</p>
                  <p className="text-base font-bold text-violet-900 dark:text-violet-100">{fmtPct(mo.pago_link_cuadre_pct)}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-zinc-700">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "dias" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Cuadre por Día</h3>
            {stats && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {stats.diasCuadrados} días cuadrados
                <XCircle className="h-3.5 w-3.5 text-amber-500 ml-1" />
                {stats.diasTotales - stats.diasCuadrados} con diferencia
              </span>
            )}
          </div>
          <DailyTable summaries={data?.daily_summaries ?? []} />
        </div>
      )}

      {activeTab === "mensual" && stats && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Resumen Mensual</h3>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {[
                  { label: "Total ventas del mes",       value: fmtNum(stats.totalVentas),     cls: "text-slate-800 dark:text-slate-100" },
                  { label: "Total conciliado",           value: fmtNum(stats.totalConciliado), cls: "text-emerald-700 dark:text-emerald-400 font-semibold" },
                  { label: "Diferencia total del mes",   value: fmtNum(stats.totalDiff),       cls: "text-amber-700 dark:text-amber-400 font-semibold" },
                  { label: "Sobrantes totales",          value: fmtNum(stats.totalSobrante),   cls: "text-blue-700 dark:text-blue-400" },
                  { label: "Faltantes totales",          value: fmtNum(stats.totalFaltante),   cls: "text-red-600 dark:text-red-400" },
                  { label: "Propinas del mes",           value: stats.totalPropinas > 0 ? fmtNum(stats.totalPropinas) : "—", cls: "text-pink-600 dark:text-pink-400" },
                  { label: "% de cuadre del mes",        value: fmtPct(stats.cuadrePct),       cls: stats.cuadrePct >= 90 ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-amber-700 dark:text-amber-400 font-bold" },
                  { label: "Días cuadrados / total",     value: `${stats.diasCuadrados} / ${stats.diasTotales}`, cls: "text-slate-700 dark:text-slate-300" },
                ].map(({ label, value, cls }) => (
                  <tr key={label} className="border-b border-slate-100 dark:border-zinc-800">
                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 font-medium">{label}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums text-sm ${cls}`}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* % cuadre bar */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide">Evolución del Cuadre Diario</p>
            <div className="space-y-1.5">
              {[...data!.daily_summaries].sort((a, b) => a.date.localeCompare(b.date)).map((d) => {
                const diff = d.difference ?? 0;
                const isOk = Math.abs(diff) < 0.5;
                return (
                  <div key={d.date} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-slate-500 dark:text-slate-400 font-medium">{fmtDate(d.date)}</span>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-zinc-700 rounded overflow-hidden">
                      <div
                        className={`h-full ${isOk ? "bg-emerald-400 dark:bg-emerald-600" : "bg-amber-400 dark:bg-amber-600"}`}
                        style={{ width: isOk ? "100%" : `${Math.min((d.toteat_conciliated / Math.max(d.toteat_total, 1)) * 100, 100)}%` }}
                      />
                    </div>
                    {isOk
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    }
                    <span className={`w-14 text-right tabular-nums ${isOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} font-semibold`}>
                      {fmtPct(d.toteat_total > 0 ? (d.toteat_conciliated / d.toteat_total) * 100 : 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "algoritmos" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Efectividad por Algoritmo</h3>
          </div>
          {data?.method_stats && data.method_stats.length > 0 ? (
            <MethodStatsTable stats={data.method_stats} />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
              <Cpu className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sin estadísticas de algoritmos para esta instancia
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page wrapper ─────────────────────────────────────────────────────────────

export default function AuditoriaPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">Auditoría</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cuadres por día · Diferencias · Algoritmos
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}>
        <AuditoriaContent />
      </Suspense>
    </div>
  );
}
