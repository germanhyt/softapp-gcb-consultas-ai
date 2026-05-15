"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { formatSoles } from "@/lib/config/column-rules";

// Delivery sub-channels — grouped under "Delivery"
const DELIVERY_CANALES = ["Rappi", "PedidosYa", "UberEats"];
// Main channel names (presencial = Salón)
const CANAL_SALON     = ["Salón", "Patio"];  // "Patio" acepted for backward compat
// Named channels — shown with their own names
const CANAL_NOMBRADOS = ["Fidelio", "Pago Link", "Eventos", "Llevar", "Cuponatic", "Bosque Mágico"];

interface NegocioData {
  total: number;
  presupuesto?: number;
  canales: Record<string, number>;
  propinas?: number;
  medios_pago?: Record<string, number>;
}

interface NegocioTableProps {
  negocios: Record<string, NegocioData>;
  grand_total: number;
  viewMode?: "canales" | "medios_pago";
}

function pct(part: number, total: number) {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "—";
}

function CumplBar({ cumpl }: { cumpl: number }) {
  const color =
    cumpl >= 100 ? "bg-emerald-500" :
    cumpl >= 80  ? "bg-blue-500" :
    cumpl >= 60  ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(cumpl, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${
        cumpl >= 100 ? "text-emerald-600 dark:text-emerald-400" :
        cumpl >= 80  ? "text-blue-600 dark:text-blue-400" :
        cumpl >= 60  ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
      }`}>{cumpl.toFixed(1)}%</span>
    </div>
  );
}

interface CanalesGrouped {
  salon: number;
  delivery: { total: number; sub: Record<string, number> };
  nombrados: Record<string, number>;   // Fidelio, Pago Link, Eventos, Llevar, Cuponatic, Bosque Mágico
  otros: Record<string, number>;       // anything else
}

function groupCanales(canales: Record<string, number>): CanalesGrouped {
  const deliverySub: Record<string, number> = {};
  let salonTotal = 0;
  const nombrados: Record<string, number> = {};
  const otros: Record<string, number> = {};

  for (const [canal, amount] of Object.entries(canales)) {
    if (DELIVERY_CANALES.includes(canal)) {
      deliverySub[canal] = amount;
    } else if (CANAL_SALON.includes(canal)) {
      salonTotal += amount;
    } else if (CANAL_NOMBRADOS.includes(canal)) {
      nombrados[canal] = (nombrados[canal] || 0) + amount;
    } else {
      otros[canal] = (otros[canal] || 0) + amount;
    }
  }

  return {
    salon: Math.round(salonTotal * 100) / 100,
    delivery: {
      total: Math.round(Object.values(deliverySub).reduce((s, v) => s + v, 0) * 100) / 100,
      sub: deliverySub,
    },
    nombrados,
    otros,
  };
}

export function NegocioTable({ negocios, grand_total, viewMode = "canales" }: NegocioTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deliveryExpanded, setDeliveryExpanded] = useState<Record<string, boolean>>({});

  const negocioList = Object.entries(negocios).sort(([, a], [, b]) => b.total - a.total);
  const hasBudget   = negocioList.some(([, d]) => d.presupuesto != null);
  const hasPropinas = negocioList.some(([, d]) => d.propinas != null && d.propinas > 0);

  const toggle         = (neg: string) => setExpanded(p => ({ ...p, [neg]: !p[neg] }));
  const toggleDelivery = (neg: string) => setDeliveryExpanded(p => ({ ...p, [neg]: !p[neg] }));

  // Extra cols: [Presup, Cumpl] + [Propinas] + % Total
  const colSpanFull = 3 + (hasBudget ? 2 : 0) + (hasPropinas ? 1 : 0);

  const grandPropinas = negocioList.reduce((s, [, d]) => s + (d.propinas || 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 min-w-[180px]">Negocio / Canal</th>
            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Ventas</th>
            {hasBudget && <>
              <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Presupuesto</th>
              <th className="text-left px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Cumpl.</th>
            </>}
            {hasPropinas && (
              <th className="text-right px-4 py-2.5 font-semibold text-pink-600 dark:text-pink-400">Propinas</th>
            )}
            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300">% Total</th>
          </tr>
        </thead>
        <tbody>
          {negocioList.map(([neg, data]) => {
            const isOpen     = !!expanded[neg];
            const isDelOpen  = !!deliveryExpanded[neg];
            const cumpl      = data.presupuesto && data.presupuesto > 0
              ? (data.total / data.presupuesto) * 100 : null;
            const grouped    = groupCanales(data.canales);
            const hasCanales = Object.keys(data.canales).length > 0;
            const hasMedios  = data.medios_pago != null;
            const isMediosView = viewMode === "medios_pago";

            return (
              <>
                {/* ── Negocio row ── */}
                <tr
                  key={neg}
                  onClick={() => (hasCanales || hasMedios) && toggle(neg)}
                  className={`border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40 cursor-pointer ${isMediosView ? "bg-slate-50/60 dark:bg-zinc-800/20" : ""}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-100">
                    <span className="flex items-center gap-1.5">
                      {(hasCanales || hasMedios)
                        ? (isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />)
                        : <span className="w-3.5" />}
                      {neg}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatSoles(data.total)}
                  </td>
                  {hasBudget && <>
                    <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                      {data.presupuesto != null ? formatSoles(data.presupuesto) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {cumpl !== null ? <CumplBar cumpl={cumpl} /> : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                  </>}
                  {hasPropinas && (
                    <td className="px-4 py-2.5 text-right text-pink-600 dark:text-pink-400 tabular-nums text-xs">
                      {data.propinas ? formatSoles(data.propinas) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {pct(data.total, grand_total)}
                  </td>
                </tr>

                {/* ── Expanded rows ── */}
                {isOpen && (
                  <>
                    {/* ── Vista Medios de Pago ── */}
                    {isMediosView && data.medios_pago && (() => {
                      const MP_LABELS: Record<string, { label: string; color: string }> = {
                        efectivo:  { label: "Efectivo",  color: "text-emerald-700 dark:text-emerald-400" },
                        tarjeta:   { label: "Tarjeta",   color: "text-blue-700 dark:text-blue-400" },
                        otros:     { label: "Otros",     color: "text-amber-700 dark:text-amber-400" },
                        pago_link: { label: "Pago Link", color: "text-violet-700 dark:text-violet-400" },
                        propinas:  { label: "Propinas",  color: "text-pink-600 dark:text-pink-400" },
                      };
                      return Object.entries(MP_LABELS).map(([key, { label, color }]) => {
                        const amount = data.medios_pago![key] ?? 0;
                        if (amount <= 0) return null;
                        return (
                          <tr key={`${neg}-mp-${key}`} className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/30">
                            <td className="pl-9 pr-4 py-1.5 text-slate-600 dark:text-slate-300">
                              <span className="flex items-center gap-1.5">
                                <span className="w-3.5" />
                                {label}
                              </span>
                            </td>
                            <td className={`px-4 py-1.5 text-right tabular-nums font-medium ${color}`}>
                              {formatSoles(amount)}
                            </td>
                            {hasBudget && <><td /><td /></>}
                            {hasPropinas && <td />}
                            <td className="px-4 py-1.5 text-right text-xs text-slate-400 tabular-nums">
                              {pct(amount, data.total)}
                            </td>
                          </tr>
                        );
                      });
                    })()}

                    {/* ── Vista Canales ── */}
                    {!isMediosView && <>
                    {/* Salón (canal principal presencial) */}
                    {grouped.salon > 0 && (
                      <tr key={`${neg}-salon`} className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/30">
                        <td className="pl-9 pr-4 py-1.5 text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5" />
                            Salón
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                          {formatSoles(grouped.salon)}
                        </td>
                        {hasBudget && <><td /><td /></>}
                        {hasPropinas && <td />}
                        <td className="px-4 py-1.5 text-right text-xs text-slate-400 tabular-nums">
                          {pct(grouped.salon, data.total)}
                        </td>
                      </tr>
                    )}

                    {/* Delivery (grouped, expandable) */}
                    {grouped.delivery.total > 0 && (
                      <>
                        <tr
                          key={`${neg}-delivery`}
                          onClick={(e) => { e.stopPropagation(); toggleDelivery(neg); }}
                          className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/30 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-zinc-800/40"
                        >
                          <td className="pl-9 pr-4 py-1.5 text-slate-600 dark:text-slate-300">
                            <span className="flex items-center gap-1.5">
                              {isDelOpen
                                ? <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                                : <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />}
                              Delivery
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                            {formatSoles(grouped.delivery.total)}
                          </td>
                          {hasBudget && <><td /><td /></>}
                          {hasPropinas && <td />}
                          <td className="px-4 py-1.5 text-right text-xs text-slate-400 tabular-nums">
                            {pct(grouped.delivery.total, data.total)}
                          </td>
                        </tr>

                        {/* Delivery sub-channels */}
                        {isDelOpen && Object.entries(grouped.delivery.sub)
                          .sort(([, a], [, b]) => b - a)
                          .map(([subCanal, amount]) => (
                            <tr
                              key={`${neg}-delivery-${subCanal}`}
                              className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/20 dark:bg-zinc-900/20"
                            >
                              <td className="pl-14 pr-4 py-1 text-xs text-slate-500 dark:text-slate-400">
                                {subCanal}
                              </td>
                              <td className="px-4 py-1 text-right text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                                {formatSoles(amount)}
                              </td>
                              {hasBudget && <><td /><td /></>}
                              {hasPropinas && <td />}
                              <td className="px-4 py-1 text-right text-xs text-slate-400 tabular-nums">
                                {pct(amount, grouped.delivery.total)}
                              </td>
                            </tr>
                          ))}
                      </>
                    )}

                    {/* Canales nombrados: Fidelio, Pago Link, Eventos, Llevar, Cuponatic, Bosque Mágico */}
                    {Object.entries(grouped.nombrados).sort(([, a], [, b]) => b - a).map(([canal, amount]) => (
                      <tr
                        key={`${neg}-nom-${canal}`}
                        className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/30"
                      >
                        <td className="pl-9 pr-4 py-1.5 text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5" />
                            {canal}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                          {formatSoles(amount)}
                        </td>
                        {hasBudget && <><td /><td /></>}
                        {hasPropinas && <td />}
                        <td className="px-4 py-1.5 text-right text-xs text-slate-400 tabular-nums">
                          {pct(amount, data.total)}
                        </td>
                      </tr>
                    ))}

                    {/* Otros canales (fallback) */}
                    {Object.entries(grouped.otros).map(([canal, amount]) => (
                      <tr
                        key={`${neg}-${canal}`}
                        className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/30"
                      >
                        <td className="pl-9 pr-4 py-1.5 text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5" />
                            {canal}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                          {formatSoles(amount)}
                        </td>
                        {hasBudget && <><td /><td /></>}
                        {hasPropinas && <td />}
                        <td className="px-4 py-1.5 text-right text-xs text-slate-400 tabular-nums">
                          {pct(amount, data.total)}
                        </td>
                      </tr>
                    ))}
                    </> /* fin !isMediosView */}
                  </>
                )}
              </>
            );
          })}

          {/* Total row */}
          <tr className="bg-slate-100 dark:bg-zinc-800 font-semibold border-t-2 border-slate-300 dark:border-zinc-600">
            <td className="px-4 py-2.5 text-slate-800 dark:text-slate-100">Total Cavas Reunidas</td>
            <td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatSoles(grand_total)}
            </td>
            {hasBudget && (
              <>
                <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatSoles(negocioList.reduce((s, [, d]) => s + (d.presupuesto || 0), 0))}
                </td>
                <td className="px-4 py-2.5">
                  {(() => {
                    const totalBudget = negocioList.reduce((s, [, d]) => s + (d.presupuesto || 0), 0);
                    return totalBudget > 0
                      ? <CumplBar cumpl={(grand_total / totalBudget) * 100} />
                      : <span className="text-slate-400 text-xs">—</span>;
                  })()}
                </td>
              </>
            )}
            {hasPropinas && (
              <td className="px-4 py-2.5 text-right text-pink-600 dark:text-pink-400 tabular-nums text-xs">
                {grandPropinas > 0 ? formatSoles(grandPropinas) : "—"}
              </td>
            )}
            <td className="px-4 py-2.5 text-right text-xs text-slate-500">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
