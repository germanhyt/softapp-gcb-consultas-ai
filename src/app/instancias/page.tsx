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
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// Estado styles using design system tokens
const ESTADO_CONFIG: Record<string, {
  label: string;
  bg: string;
  color: string;
  dot: string;
  dotAnim?: string;
}> = {
  OPEN:        { label: "Abierta",    bg: "rgba(56,209,73,0.12)",  color: "var(--primary)",   dot: "var(--primary)" },
  CLOSED:      { label: "Cerrada",    bg: "rgba(113,122,109,0.12)",color: "var(--neutral)",   dot: "var(--neutral)" },
  IN_PROGRESS: { label: "En Proceso", bg: "rgba(96,165,250,0.12)", color: "#60a5fa",          dot: "#60a5fa", dotAnim: "animate-pulse" },
  PENDING:     { label: "Pendiente",  bg: "rgba(255,159,67,0.12)", color: "var(--secondary)", dot: "var(--secondary)" },
  COMPLETED:   { label: "Completada", bg: "rgba(113,122,109,0.12)",color: "var(--neutral)",   dot: "var(--neutral)" },
};

const ESTADO_PRIORITY: Record<string, number> = {
  OPEN: 0, IN_PROGRESS: 1, PENDING: 2, COMPLETED: 3, CLOSED: 4,
};

function parseMonthKey(dateStr: string): { key: string; label: string; year: number; month: number } {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() + 1 };
    }
  } catch { /* */ }
  return { key: "9999-99", label: "Sin Fecha", year: 9999, month: 99 };
}

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
  const val   = Math.min(Math.max(pct ?? 0, 0), 100);
  const color = val >= 90 ? "var(--primary)" : val >= 70 ? "#60a5fa" : val >= 50 ? "var(--secondary)" : "var(--tertiary)";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${val}%`, background: color }}
        />
      </div>
      <span className="text-sm font-bold tabular-nums w-14 text-right" style={{ color }}>
        {val.toFixed(1)}%
      </span>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const c = ESTADO_CONFIG[estado] || {
    label: estado,
    bg: "rgba(113,122,109,0.10)",
    color: "var(--neutral)",
    dot: "var(--neutral)",
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.color }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${c.dotAnim ?? ""}`}
        style={{ background: c.dot }}
      />
      {c.label}
    </span>
  );
}

// KPI card config
const KPI_CARDS = (
  totalMeses: number,
  abiertos: number,
  avgCobertura: number,
  totalConciliado: number,
  totalPendiente: number,
) => [
  {
    label: "Meses registrados",
    value: String(totalMeses),
    sub: `${abiertos} activo${abiertos !== 1 ? "s" : ""}`,
    accent: "#60a5fa",
    glow: "rgba(96,165,250,0.20)",
    bg: "rgba(96,165,250,0.07)",
    border: "rgba(96,165,250,0.20)",
  },
  {
    label: "Cobertura promedio",
    value: `${avgCobertura}%`,
    sub: avgCobertura >= 90 ? "Excelente" : avgCobertura >= 70 ? "Buena" : "Mejorable",
    accent: "var(--primary)",
    glow: "rgba(56,209,73,0.20)",
    bg: "rgba(56,209,73,0.07)",
    border: "rgba(56,209,73,0.20)",
  },
  {
    label: "Conciliadas",
    value: totalConciliado.toLocaleString("es-PE"),
    sub: "transacciones",
    accent: "#a78bfa",
    glow: "rgba(167,139,250,0.20)",
    bg: "rgba(167,139,250,0.07)",
    border: "rgba(167,139,250,0.20)",
  },
  {
    label: "Pendientes",
    value: totalPendiente.toLocaleString("es-PE"),
    sub: "transacciones",
    accent: "var(--secondary)",
    glow: "rgba(255,159,67,0.20)",
    bg: "rgba(255,159,67,0.07)",
    border: "rgba(255,159,67,0.20)",
  },
];

export default function InstanciasPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instancias")
      .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json(); })
      .then((data) => setInstances(Array.isArray(data) ? data : []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const months = useMemo(() => deduplicateByMonth(instances), [instances]);

  const totalMeses      = months.length;
  const abiertos        = months.filter((m) => m.estado === "OPEN" || m.estado === "IN_PROGRESS").length;
  const avgCobertura    = totalMeses > 0
    ? Math.round(months.reduce((s, m) => s + (m.cobertura_pct ?? 0), 0) / totalMeses * 10) / 10 : 0;
  const totalConciliado = months.reduce((s, m) => s + (m.toteat_conciliado ?? 0), 0);
  const totalPendiente  = months.reduce((s, m) => s + (m.toteat_pendiente  ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)" }}
        >
          <Calendar className="h-5 w-5" style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight" style={{ color: "var(--foreground)" }}>
            Instancias de Conciliación
          </h2>
          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            Una instancia por mes · revisión histórica
          </p>
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#60a5fa" }} />
        </div>
      )}
      {!loading && error && (
        <div
          className="rounded-xl p-4 text-sm flex items-center gap-2"
          style={{ background: "rgba(214,84,84,0.08)", border: "1px solid rgba(214,84,84,0.25)", color: "var(--tertiary)" }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          No se pudo cargar las instancias: {error}
        </div>
      )}
      {!loading && !error && months.length === 0 && (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" style={{ color: "var(--foreground-muted)" }} />
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No hay instancias disponibles</p>
        </div>
      )}

      {!loading && !error && months.length > 0 && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {KPI_CARDS(totalMeses, abiertos, avgCobertura, totalConciliado, totalPendiente).map((c) => (
              <div
                key={c.label}
                className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.02]"
                style={{ background: c.bg, border: `1px solid ${c.border}`, boxShadow: `0 4px 20px ${c.glow}` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--foreground-muted)" }}>
                  {c.label}
                </p>
                <p className="text-2xl font-bold tabular-nums leading-tight" style={{ color: "var(--foreground)" }}>
                  {c.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--foreground-subtle)" }}>{c.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Month list ── */}
          <div className="space-y-3">
            {months.map((m) => {
              const cobertura = m.cobertura_pct ?? 0;
              const isActive  = m.estado === "OPEN" || m.estado === "IN_PROGRESS";

              return (
                <div
                  key={m.monthKey}
                  className="rounded-xl transition-all duration-200"
                  style={{
                    background: "var(--surface)",
                    border: isActive
                      ? "1px solid rgba(96,165,250,0.30)"
                      : "1px solid var(--border)",
                    boxShadow: isActive ? "0 0 16px rgba(96,165,250,0.08)" : "none",
                  }}
                >
                  <div className="p-4 space-y-3">
                    {/* Month name + estado */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black"
                          style={{
                            background: isActive ? "rgba(96,165,250,0.15)" : "var(--surface-2)",
                            color: isActive ? "#60a5fa" : "var(--foreground-muted)",
                            border: isActive ? "1px solid rgba(96,165,250,0.25)" : "1px solid var(--border)",
                          }}
                        >
                          {m.monthLabel.slice(0, 3).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-base leading-tight" style={{ color: "var(--foreground)" }}>
                            {m.monthLabel}
                          </p>
                          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                            Instancia #{m.id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <EstadoBadge estado={m.estado} />
                        <Link
                          href={`/auditoria?instancia=${m.id}&mes=${m.monthKey}`}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150"
                          style={{
                            background: "var(--primary)",
                            color: "var(--primary-foreground)",
                          }}
                        >
                          Ver Auditoría
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Coverage */}
                    <div>
                      <div className="flex items-center mb-1.5">
                        <span className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                          <TrendingUp className="h-3 w-3" />
                          Cobertura TOTEAT
                        </span>
                      </div>
                      <CoberturaBar pct={cobertura} />
                    </div>

                    {/* Stats grid */}
                    <div
                      className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>TOTEAT</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                          {(m.toteat_total ?? 0).toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                          <CheckCircle2 className="h-2.5 w-2.5" style={{ color: "var(--primary)" }} />
                          Conciliado
                        </p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: "var(--primary)" }}>
                          {(m.toteat_conciliado ?? 0).toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                          <Clock className="h-2.5 w-2.5" style={{ color: "var(--secondary)" }} />
                          Pendiente
                        </p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: "var(--secondary)" }}>
                          {(m.toteat_pendiente ?? 0).toLocaleString("es-PE")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>Vouchers</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: "#60a5fa" }}>
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
