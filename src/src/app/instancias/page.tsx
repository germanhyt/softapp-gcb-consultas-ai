"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Calendar, TrendingUp, AlertCircle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

interface Instance {
  id: number;
  name: string;
  nombre: string;
  descripcion: string;
  estado: string;
  toteat_total: number;
  toteat_conciliado: number;
  toteat_pendiente: number;
  vouchers_total: number;
  cobertura_pct: number;
  fecha_inicio: string;
  fecha_cierre: string;
}

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Estado display config
const ESTADO_CONFIG: Record<string, { label: string; badgeCls: string; dot: string }> = {
  OPEN:        { label: "Abierta",    badgeCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  CLOSED:      { label: "Cerrada",    badgeCls: "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-slate-300",             dot: "bg-slate-400" },
  IN_PROGRESS: { label: "En Proceso", badgeCls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",            dot: "bg-blue-500 animate-pulse" },
  PENDING:     { label: "Pendiente",  badgeCls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",        dot: "bg-amber-500" },
  COMPLETED:   { label: "Completada", badgeCls: "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-slate-300",            dot: "bg-slate-400" },
};

// Priority for deduplication: lower = better
const ESTADO_PRIORITY: Record<string, number> = {
  OPEN: 0, IN_PROGRESS: 1, PENDING: 2, COMPLETED: 3, CLOSED: 4,
};

function parseMonthKey(dateStr: string): { key: string; label: string; year: number; month: number } {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
      return { key, label, year: d.getFullYear(), month: d.getMonth() + 1 };
    }
  } catch { /* fall through */ }
  return { key: "9999-99", label: "Sin Fecha", year: 9999, month: 99 };
}

/** One instance per month — takes the "best" by estado priority, then highest cobertura */
function deduplicateByMonth(instances: Instance[]): Array<Instance & { monthKey: string; monthLabel: string }> {
  const map = new Map<string, Instance & { monthKey: string; monthLabel: string }>();

  for (const inst of instances) {
    const { key, label } = parseMonthKey(inst.fecha_inicio);
    const enriched = { ...inst, monthKey: key, monthLabel: label };
    const existing = map.get(key);
    if (!existing) {
      map.set(key, enriched);
    } else {
      const ep = ESTADO_PRIORITY[existing.estado] ?? 99;
      const np = ESTADO_PRIORITY[inst.estado] ?? 99;
      if (np < ep || (np === ep && (inst.cobertura_pct ?? 0) > (existing.cobertura_pct ?? 0))) {
        map.set(key, enriched);
      }
    }
  }

  return [...map.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

function CoberturaBar({ pct }: { pct: number }) {
  const val = Math.min(Math.max(pct ?? 0, 0), 100);
  const color =
    val >= 90 ? "bg-emerald-500" :
    val >= 70 ? "bg-blue-500" :
    val >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor =
    val >= 90 ? "text-emerald-700 dark:text-emerald-400" :
    val >= 70 ? "text-blue-700 dark:text-blue-400" :
    val >= 50 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${val}%` }} />
      </div>
      <span className={`text-sm font-bold tabular-nums w-14 text-right ${textColor}`}>
        {val.toFixed(1)}%
      </span>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const c = ESTADO_CONFIG[estado] || { label: estado, badgeCls: "bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-slate-400", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${c.badgeCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function InstanciasPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instancias")
      .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json(); })
      .then((data) => setInstances(Array.isArray(data) ? data : []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const months = useMemo(() => deduplicateByMonth(instances), [instances]);

  // KPI stats
  const totalMeses       = months.length;
  const abiertos         = months.filter((m) => m.estado === "OPEN" || m.estado === "IN_PROGRESS").length;
  const avgCobertura     = totalMeses > 0
    ? Math.round(months.reduce((s, m) => s + (m.cobertura_pct ?? 0), 0) / totalMeses * 10) / 10 : 0;
  const totalConciliado  = months.reduce((s, m) => s + (m.toteat_conciliado ?? 0), 0);
  const totalPendiente   = months.reduce((s, m) => s + (m.toteat_pendiente  ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
            Instancias de Conciliación
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Una instancia por mes · revisión histórica
          </p>
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          No se pudo cargar las instancias: {error}
        </div>
      )}
      {!loading && !error && months.length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-10 text-center text-slate-500 dark:text-slate-400">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay instancias disponibles</p>
        </div>
      )}

      {!loading && !error && months.length > 0 && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Meses registrados",
                value: String(totalMeses),
                sub: `${abiertos} activo${abiertos !== 1 ? "s" : ""}`,
                border: "border-blue-300 dark:border-blue-700",
                bg: "bg-blue-50 dark:bg-blue-950/40",
                text: "text-blue-900 dark:text-blue-100",
                icon: "from-blue-600 to-blue-700",
              },
              {
                label: "Cobertura promedio",
                value: `${avgCobertura}%`,
                sub: avgCobertura >= 90 ? "Excelente" : avgCobertura >= 70 ? "Buena" : "Mejorable",
                border: "border-emerald-300 dark:border-emerald-700",
                bg: "bg-emerald-50 dark:bg-emerald-950/40",
                text: "text-emerald-900 dark:text-emerald-100",
                icon: "from-emerald-600 to-emerald-700",
              },
              {
                label: "Conciliadas",
                value: totalConciliado.toLocaleString("es-PE"),
                sub: "transacciones",
                border: "border-violet-300 dark:border-violet-700",
                bg: "bg-violet-50 dark:bg-violet-950/40",
                text: "text-violet-900 dark:text-violet-100",
                icon: "from-violet-600 to-violet-700",
              },
              {
                label: "Pendientes",
                value: totalPendiente.toLocaleString("es-PE"),
                sub: "transacciones",
                border: "border-amber-300 dark:border-amber-700",
                bg: "bg-amber-50 dark:bg-amber-950/40",
                text: "text-amber-900 dark:text-amber-100",
                icon: "from-amber-600 to-amber-700",
              },
            ].map((c) => (
              <div key={c.label} className={`rounded-xl border-2 p-4 shadow-sm ${c.border} ${c.bg}`}>
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className={`text-2xl font-bold tabular-nums leading-tight ${c.text}`}>{c.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Month list ── */}
          <div className="space-y-3">
            {months.map((m) => {
              const cobertura = m.cobertura_pct ?? 0;
              const isActive = m.estado === "OPEN" || m.estado === "IN_PROGRESS";

              return (
                <div
                  key={m.monthKey}
                  className={`rounded-xl border-2 bg-white dark:bg-zinc-900 shadow-sm transition-shadow hover:shadow-md ${
                    isActive
                      ? "border-blue-300 dark:border-blue-700"
                      : "border-slate-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="p-4 space-y-3">
                    {/* Month name + estado */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-black shadow-sm bg-gradient-to-br ${
                          isActive ? "from-blue-500 to-blue-700" : "from-slate-400 to-slate-600"
                        }`}>
                          {m.monthLabel.slice(0, 3).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                            {m.monthLabel}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Instancia #{m.id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <EstadoBadge estado={m.estado} />
                        <Link
                          href={`/auditoria?instancia=${m.id}&mes=${m.monthKey}`}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                        >
                          Ver Auditoría
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Coverage */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Cobertura TOTEAT
                        </span>
                      </div>
                      <CoberturaBar pct={cobertura} />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">TOTEAT</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                          {(m.toteat_total ?? 0).toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                          Conciliado
                        </p>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {(m.toteat_conciliado ?? 0).toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 text-amber-500" />
                          Pendiente
                        </p>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          {(m.toteat_pendiente ?? 0).toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vouchers</p>
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                          {(m.vouchers_total ?? 0).toLocaleString("es-PE")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
