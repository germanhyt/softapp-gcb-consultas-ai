"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

const DIAS = [
  { label: "L", value: 2, title: "Lunes" },
  { label: "M", value: 3, title: "Martes" },
  { label: "X", value: 4, title: "Miércoles" },
  { label: "J", value: 5, title: "Jueves" },
  { label: "V", value: 6, title: "Viernes" },
  { label: "S", value: 7, title: "Sábado" },
  { label: "D", value: 1, title: "Domingo" },
];

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  turno?: string;
  diasSemana?: number[];
  negocios?: string[];
  viewMode?: "canales" | "medios_pago";
}

interface DateFilterProps {
  filters: DashboardFilters;
  turnos: string[];
  negocioList: string[];
  onChange: (f: DashboardFilters) => void;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yearRange(y: number) { return { startDate: `${y}-01-01`, endDate: `${y}-12-31` }; }
function curMonthRange() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
  const last = new Date(y, m, 0).getDate(), mp = String(m).padStart(2, "0");
  return { startDate: `${y}-${mp}-01`, endDate: `${y}-${mp}-${String(last).padStart(2, "0")}` };
}

// ── Shared button styles ──────────────────────────────────────────────────────
const btnBase = {
  base: "text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all duration-150 leading-tight cursor-pointer border",
};

function FilterChip({
  label,
  active,
  accentColor = "var(--primary)",
  onClick,
}: {
  label: string;
  active: boolean;
  accentColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${btnBase.base} ${active ? "text-[--primary-foreground]" : ""}`}
      style={
        active
          ? {
              background: accentColor,
              borderColor: accentColor,
              color: "var(--primary-foreground)",
              boxShadow: `0 0 10px ${accentColor}55`,
            }
          : {
              background: "var(--surface-2)",
              borderColor: "var(--border-strong)",
              color: "var(--foreground-muted)",
            }
      }
    >
      {label}
    </button>
  );
}

// ── Negocio multi-select dropdown ─────────────────────────────────────────────
function NegocioDropdown({
  negocioList, selected, onToggle, onClear,
}: {
  negocioList: string[];
  selected: string[];
  onToggle: (n: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label =
    selected.length === 0
      ? "Todos los negocios"
      : selected.length === 1
      ? selected[0]
      : `${selected[0]} +${selected.length - 1} más`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${btnBase.base} flex items-center gap-1.5`}
        style={
          selected.length > 0
            ? {
                background: "rgba(167,139,250,0.12)",
                borderColor: "rgba(167,139,250,0.40)",
                color: "#c4b5fd",
              }
            : {
                background: "var(--surface-2)",
                borderColor: "var(--border-strong)",
                color: "var(--foreground-muted)",
              }
        }
      >
        {label}
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-xl shadow-2xl py-1.5 min-w-[190px]"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
          }}
        >
          <button
            onClick={() => { onClear(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 font-semibold transition-colors duration-100"
            style={{ color: "var(--foreground)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-3)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            Todos los negocios
            {selected.length === 0 && (
              <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
            )}
          </button>
          <div className="my-1" style={{ height: 1, background: "var(--border)" }} />
          {negocioList.map((n) => (
            <button
              key={n}
              onClick={() => onToggle(n)}
              className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 font-medium transition-colors duration-100"
              style={{
                color: selected.includes(n) ? "#c4b5fd" : "var(--foreground-muted)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-3)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span>{n}</span>
              {selected.includes(n) && (
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#a78bfa" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Label component ───────────────────────────────────────────────────────────
function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-widest shrink-0"
      style={{ color: "var(--foreground-subtle)" }}
    >
      {children}
    </span>
  );
}

// ── Main filter bar ───────────────────────────────────────────────────────────
export function DateFilter({ filters, turnos, negocioList, onChange }: DateFilterProps) {
  const curYear = new Date().getFullYear();
  const td = todayStr(), yr = yearRange(curYear), yrP = yearRange(curYear - 1), cm = curMonthRange();

  const upd = (p: Partial<DashboardFilters>) => onChange({ ...filters, ...p });
  const isActive = (s: string, e: string) => filters.startDate === s && filters.endDate === e;
  const toggleTurno = (t: string) => upd({ turno: filters.turno === t ? undefined : t });
  const toggleDia   = (v: number) => {
    const cur = filters.diasSemana || [];
    const next = cur.includes(v) ? cur.filter((d) => d !== v) : [...cur, v];
    upd({ diasSemana: next.length > 0 ? next : undefined });
  };
  const toggleNeg = (n: string) => {
    const cur = filters.negocios || [];
    const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
    upd({ negocios: next.length > 0 ? next : undefined });
  };

  const inputStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    border: "1px solid var(--border-strong)",
    borderRadius: "0.5rem",
    padding: "0.3rem 0.5rem",
    background: "var(--surface-2)",
    color: "var(--foreground)",
    fontFamily: "inherit",
    fontWeight: 500,
    outline: "none",
    transition: "border-color 0.15s",
    colorScheme: "dark",
  };

  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.30)",
      }}
    >
      {/* Período atajos */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterLabel>Período:</FilterLabel>
        {[
          { label: String(curYear), ...yr },
          { label: String(curYear - 1), ...yrP },
          { label: "Este mes", ...cm },
          { label: "Hoy", startDate: td, endDate: td },
        ].map((s) => (
          <FilterChip
            key={s.label}
            label={s.label}
            active={isActive(s.startDate, s.endDate)}
            onClick={() => upd({ startDate: s.startDate, endDate: s.endDate })}
          />
        ))}
      </div>

      {/* Rango personalizado */}
      <div className="flex items-center gap-2">
        <FilterLabel>Rango:</FilterLabel>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => upd({ startDate: e.target.value })}
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = "var(--primary)")}
          onBlur={e => (e.target.style.borderColor = "var(--border-strong)")}
        />
        <span className="text-sm font-bold" style={{ color: "var(--foreground-muted)" }}>→</span>
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => upd({ endDate: e.target.value })}
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = "var(--primary)")}
          onBlur={e => (e.target.style.borderColor = "var(--border-strong)")}
        />
      </div>

      {/* Negocio dropdown */}
      {negocioList.length > 0 && (
        <div className="flex items-center gap-2">
          <FilterLabel>Negocio:</FilterLabel>
          <NegocioDropdown
            negocioList={negocioList}
            selected={filters.negocios || []}
            onToggle={toggleNeg}
            onClear={() => upd({ negocios: undefined })}
          />
        </div>
      )}

      {/* Turno */}
      {turnos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <FilterLabel>Turno:</FilterLabel>
          {turnos.map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={filters.turno === t}
              accentColor="#60a5fa"
              onClick={() => toggleTurno(t)}
            />
          ))}
          {filters.turno && (
            <button
              onClick={() => upd({ turno: undefined })}
              className="text-sm font-black leading-none px-1 transition-colors"
              style={{ color: "var(--foreground-subtle)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--tertiary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--foreground-subtle)")}
            >✕</button>
          )}
        </div>
      )}

      {/* Días semana */}
      <div className="flex items-center gap-1.5">
        <FilterLabel className="mr-0.5">Días:</FilterLabel>
        {DIAS.map(({ label, value, title }) => {
          const active = (filters.diasSemana || []).includes(value);
          return (
            <button
              key={value}
              title={title}
              onClick={() => toggleDia(value)}
              className="text-xs w-8 h-8 rounded-lg font-black transition-all duration-150 border"
              style={
                active
                  ? {
                      background: "var(--primary)",
                      borderColor: "var(--primary)",
                      color: "var(--primary-foreground)",
                      boxShadow: "0 0 10px rgba(56,209,73,0.40)",
                    }
                  : {
                      background: "var(--surface-2)",
                      borderColor: "var(--border-strong)",
                      color: "var(--foreground-muted)",
                    }
              }
            >
              {label}
            </button>
          );
        })}
        {filters.diasSemana && filters.diasSemana.length > 0 && (
          <button
            onClick={() => upd({ diasSemana: undefined })}
            className="text-sm font-black leading-none px-1 transition-colors ml-0.5"
            style={{ color: "var(--foreground-subtle)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--tertiary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--foreground-subtle)")}
          >✕</button>
        )}
      </div>

      {/* Vista */}
      <div className="flex items-center gap-2">
        <FilterLabel>Ver:</FilterLabel>
        <FilterChip
          label="Por Canal"
          active={!filters.viewMode || filters.viewMode === "canales"}
          onClick={() => upd({ viewMode: undefined })}
        />
        <FilterChip
          label="Medios de Pago"
          active={filters.viewMode === "medios_pago"}
          accentColor="#a78bfa"
          onClick={() => upd({ viewMode: "medios_pago" })}
        />
      </div>
    </div>
  );
}
