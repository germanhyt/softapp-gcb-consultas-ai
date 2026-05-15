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

const lblCls  = "text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0 uppercase tracking-wide";
const btnBase = "text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-colors leading-tight";
const btnOff  = `${btnBase} border-slate-400 dark:border-zinc-500 text-slate-800 dark:text-slate-100 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700`;
const btnOn   = (c: string) => `${btnBase} bg-${c}-600 text-white border-${c}-600 shadow-sm`;

// ── Negocio multi-select dropdown ────────────────────────────────────────────
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
        className={`${btnBase} flex items-center gap-1.5 ${
          selected.length > 0
            ? "border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-500"
            : "border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700"
        }`}
      >
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-600 rounded-xl shadow-xl py-1.5 min-w-[190px]">
          {/* Todos option */}
          <button
            onClick={() => { onClear(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-between gap-2 font-semibold"
          >
            Todos los negocios
            {selected.length === 0 && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
          </button>
          <div className="border-t-2 border-slate-100 dark:border-zinc-700 my-1" />
          {negocioList.map((n) => (
            <button
              key={n}
              onClick={() => onToggle(n)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-between gap-2 font-medium ${
                selected.includes(n)
                  ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              <span>{n}</span>
              {selected.includes(n) && <Check className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main filter bar ───────────────────────────────────────────────────────────
export function DateFilter({ filters, turnos, negocioList, onChange }: DateFilterProps) {
  const curYear = new Date().getFullYear();
  const td = todayStr(), yr = yearRange(curYear), yrP = yearRange(curYear - 1), cm = curMonthRange();

  const upd = (p: Partial<DashboardFilters>) => onChange({ ...filters, ...p });
  const isActive = (s: string, e: string) => filters.startDate === s && filters.endDate === e;
  const toggleTurno  = (t: string) => upd({ turno: filters.turno === t ? undefined : t });
  const toggleDia    = (v: number) => {
    const cur = filters.diasSemana || [];
    const next = cur.includes(v) ? cur.filter((d) => d !== v) : [...cur, v];
    upd({ diasSemana: next.length > 0 ? next : undefined });
  };
  const toggleNeg = (n: string) => {
    const cur = filters.negocios || [];
    const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
    upd({ negocios: next.length > 0 ? next : undefined });
  };

  return (
    <div className="rounded-xl border-2 border-slate-300 dark:border-zinc-500 bg-white dark:bg-zinc-900 px-4 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-3 shadow-md">

      {/* Período atajos */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={lblCls}>Período:</span>
        {[
          { label: String(curYear), ...yr },
          { label: String(curYear - 1), ...yrP },
          { label: "Este mes", ...cm },
          { label: "Hoy", startDate: td, endDate: td },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => upd({ startDate: s.startDate, endDate: s.endDate })}
            className={isActive(s.startDate, s.endDate) ? btnOn("emerald") : btnOff}
          >{s.label}</button>
        ))}
      </div>

      {/* Rango personalizado */}
      <div className="flex items-center gap-2">
        <span className={lblCls}>Rango:</span>
        <input type="date" value={filters.startDate}
          onChange={(e) => upd({ startDate: e.target.value })}
          className="text-xs border-2 border-slate-400 dark:border-zinc-500 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-sm text-slate-700 dark:text-slate-200 font-bold">→</span>
        <input type="date" value={filters.endDate}
          onChange={(e) => upd({ endDate: e.target.value })}
          className="text-xs border-2 border-slate-400 dark:border-zinc-500 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Negocio dropdown */}
      {negocioList.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={lblCls}>Negocio:</span>
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
          <span className={lblCls}>Turno:</span>
          {turnos.map((t) => (
            <button key={t} onClick={() => toggleTurno(t)}
              className={filters.turno === t ? btnOn("blue") : btnOff}
            >{t}</button>
          ))}
          {filters.turno && (
            <button onClick={() => upd({ turno: undefined })}
              className="text-sm text-slate-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 font-black leading-none px-1">✕</button>
          )}
        </div>
      )}

      {/* Días semana */}
      <div className="flex items-center gap-1.5">
        <span className={`${lblCls} mr-0.5`}>Días:</span>
        {DIAS.map(({ label, value, title }) => (
          <button key={value} title={title} onClick={() => toggleDia(value)}
            className={`text-xs w-8 h-8 rounded-lg border-2 font-black transition-colors ${
              (filters.diasSemana || []).includes(value)
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "border-slate-400 dark:border-zinc-500 text-slate-800 dark:text-slate-100 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700"
            }`}
          >{label}</button>
        ))}
        {filters.diasSemana && filters.diasSemana.length > 0 && (
          <button onClick={() => upd({ diasSemana: undefined })}
            className="text-sm text-slate-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 font-black leading-none px-1 ml-0.5">✕</button>
        )}
      </div>

      {/* Vista: Canales / Medios de Pago */}
      <div className="flex items-center gap-2">
        <span className={lblCls}>Ver:</span>
        <button
          onClick={() => upd({ viewMode: undefined })}
          className={!filters.viewMode || filters.viewMode === "canales" ? btnOn("emerald") : btnOff}
        >Por Canal</button>
        <button
          onClick={() => upd({ viewMode: "medios_pago" })}
          className={filters.viewMode === "medios_pago" ? btnOn("violet") : btnOff}
        >Medios de Pago</button>
      </div>

    </div>
  );
}
