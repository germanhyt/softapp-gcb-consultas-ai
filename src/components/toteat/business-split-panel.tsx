"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { formatSoles } from "@/lib/config/column-rules";

export interface BusinessSplitData {
  rules: string[];
  by_business: Array<{
    business: "Sisa" | "Limanesas" | "Refugio";
    total: number;
    percentage: number;
    line_items: number;
    orders: number;
    average_ticket: number;
  }>;
  total: number;
}

const BUSINESS_STYLES: Record<
  BusinessSplitData["by_business"][number]["business"],
  { color: string; bg: string; border: string }
> = {
  Refugio: {
    color: "#38d149",
    bg: "rgba(56,209,73,0.12)",
    border: "rgba(56,209,73,0.35)",
  },
  Sisa: {
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.35)",
  },
  Limanesas: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
  },
};

const DISPLAY_ORDER: BusinessSplitData["by_business"][number]["business"][] = [
  "Refugio",
  "Sisa",
  "Limanesas",
];

export function BusinessSplitPanel({ data }: { data: BusinessSplitData }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const ordered = DISPLAY_ORDER.map(
    (name) => data.by_business.find((b) => b.business === name)!,
  ).filter(Boolean);

  return (
    <div
      className="rounded-xl p-4 sm:p-5 space-y-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Cruce interno — Bar Refugio / Sisa / Limanesas
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
            Total estimado por líneas de producto:{" "}
            <span className="font-semibold tabular-nums">{formatSoles(data.total)}</span>
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg"
          style={{
            background: "rgba(255,159,67,0.08)",
            border: "1px solid rgba(255,159,67,0.25)",
            color: "var(--secondary)",
          }}
        >
          <Info className="h-3 w-3 shrink-0" />
          {/* Monto por línea (products[].payed) */}
        </div>
      </div>

      {/* Barra de participación apilada */}
      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-2"
          style={{ color: "var(--foreground-subtle)" }}
        >
          Participación
        </p>
        <div className="flex h-8 rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
          {ordered.map((b) => {
            if (b.percentage <= 0) return null;
            const style = BUSINESS_STYLES[b.business];
            return (
              <div
                key={b.business}
                className="flex items-center justify-center text-[10px] font-bold transition-all"
                style={{
                  width: `${Math.max(b.percentage, b.percentage > 0 ? 2 : 0)}%`,
                  background: style.bg,
                  color: style.color,
                  borderRight: "1px solid var(--border)",
                }}
                title={`${b.business}: ${b.percentage.toFixed(1)}%`}
              >
                {b.percentage >= 8 ? `${b.percentage.toFixed(0)}%` : ""}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {ordered.map((b) => (
            <div key={b.business} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: BUSINESS_STYLES[b.business].color }}
              />
              <span style={{ color: "var(--foreground-muted)" }}>{b.business}</span>
              <span className="font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                {b.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tarjetas por negocio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ordered.map((b) => {
          const style = BUSINESS_STYLES[b.business];
          return (
            <div
              key={b.business}
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: style.color }}
              >
                {b.business}
              </p>
              <p className="text-2xl font-bold tabular-nums leading-tight" style={{ color: "var(--foreground)" }}>
                {formatSoles(b.total)}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wide opacity-70">Órdenes</p>
                  <p className="font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                    {b.orders.toLocaleString("es-PE")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide opacity-70">Ticket prom.</p>
                  <p className="font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                    {formatSoles(b.average_ticket)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reglas colapsables */}
      <button
        type="button"
        onClick={() => setRulesOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold w-full text-left"
        style={{ color: "var(--foreground-muted)" }}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${rulesOpen ? "rotate-180" : ""}`}
        />
        Ver reglas de clasificación
      </button>
      {rulesOpen && (
        <ul className="space-y-1 pl-5">
          {data.rules.map((rule) => (
            <li key={rule} className="text-xs list-disc" style={{ color: "var(--foreground-muted)" }}>
              {rule}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
