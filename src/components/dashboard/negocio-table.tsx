"use client";

import { useState, Fragment } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { formatSoles } from "@/lib/config/column-rules";

const DELIVERY_CANALES = ["Rappi", "PedidosYa", "UberEats"];
const CANAL_SALON      = ["Salón", "Patio"];
const CANAL_NOMBRADOS  = ["Fidelio", "Pago Link", "Eventos", "Llevar", "Cuponatic", "Bosque Mágico"];

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
  const accent =
    cumpl >= 100 ? "var(--primary)"    :
    cumpl >= 80  ? "#60a5fa"           :
    cumpl >= 60  ? "var(--secondary)"  :
                   "var(--tertiary)";
  const textColor =
    cumpl >= 100 ? "var(--primary)"    :
    cumpl >= 80  ? "#60a5fa"           :
    cumpl >= 60  ? "var(--secondary)"  :
                   "var(--tertiary)";
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-16 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(cumpl, 100)}%`, background: accent }}
        />
      </div>
      <span
        className="text-xs font-medium tabular-nums"
        style={{ color: textColor }}
      >
        {cumpl.toFixed(1)}%
      </span>
    </div>
  );
}

interface CanalesGrouped {
  salon: number;
  delivery: { total: number; sub: Record<string, number> };
  nombrados: Record<string, number>;
  otros: Record<string, number>;
}

function groupCanales(canales: Record<string, number>): CanalesGrouped {
  const deliverySub: Record<string, number> = {};
  let salonTotal = 0;
  const nombrados: Record<string, number> = {};
  const otros: Record<string, number> = {};

  for (const [canal, amount] of Object.entries(canales)) {
    if (DELIVERY_CANALES.includes(canal))       deliverySub[canal] = amount;
    else if (CANAL_SALON.includes(canal))        salonTotal += amount;
    else if (CANAL_NOMBRADOS.includes(canal))    nombrados[canal] = (nombrados[canal] || 0) + amount;
    else                                         otros[canal] = (otros[canal] || 0) + amount;
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

// ── Shared cell styles ────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  color: "var(--foreground-muted)",
  fontWeight: 600,
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  padding: "0.6rem 1rem",
  background: "var(--surface-2)",
  borderBottom: "1px solid var(--border-strong)",
  whiteSpace: "nowrap",
};

export function NegocioTable({ negocios, grand_total, viewMode = "canales" }: NegocioTableProps) {
  const [expanded,         setExpanded]         = useState<Record<string, boolean>>({});
  const [deliveryExpanded, setDeliveryExpanded] = useState<Record<string, boolean>>({});

  const negocioList = Object.entries(negocios).sort(([, a], [, b]) => b.total - a.total);
  const hasBudget   = negocioList.some(([, d]) => d.presupuesto != null);
  const hasPropinas = negocioList.some(([, d]) => d.propinas != null && d.propinas > 0);

  const toggle         = (neg: string) => setExpanded(p => ({ ...p, [neg]: !p[neg] }));
  const toggleDelivery = (neg: string) => setDeliveryExpanded(p => ({ ...p, [neg]: !p[neg] }));

  const grandPropinas = negocioList.reduce((s, [, d]) => s + (d.propinas || 0), 0);

  // ── Row bg helpers ──────────────────────────────────────────────────────────
  const rowHover = "var(--surface-2)";
  const subRowBg = "rgba(0,0,0,0.10)";

  return (
    <div
      className="overflow-x-auto rounded-xl"
      style={{ border: "1px solid var(--border)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Negocio / Canal</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Ventas</th>
            {hasBudget && <>
              <th style={{ ...thStyle, textAlign: "right" }}>Presupuesto</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Cumpl.</th>
            </>}
            {hasPropinas && (
              <th style={{ ...thStyle, textAlign: "right", color: "var(--secondary)" }}>Propinas</th>
            )}
            <th style={{ ...thStyle, textAlign: "right" }}>% Total</th>
          </tr>
        </thead>
        <tbody>
          {negocioList.map(([neg, data]) => {
            const isOpen    = !!expanded[neg];
            const isDelOpen = !!deliveryExpanded[neg];
            const cumpl     = data.presupuesto && data.presupuesto > 0
              ? (data.total / data.presupuesto) * 100 : null;
            const grouped    = groupCanales(data.canales);
            const hasCanales = Object.keys(data.canales).length > 0;
            const hasMedios  = data.medios_pago != null;
            const isMediosView = viewMode === "medios_pago";

            const rowStyle: React.CSSProperties = {
              borderBottom: "1px solid var(--border)",
              background: isMediosView ? subRowBg : "transparent",
              cursor: (hasCanales || hasMedios) ? "pointer" : "default",
              transition: "background 0.12s",
            };

            const cellMuted: React.CSSProperties = { color: "var(--foreground-muted)", padding: "0.55rem 1rem" };
            const cellBody:  React.CSSProperties = { color: "var(--foreground)",       padding: "0.55rem 1rem" };

            return (
              <Fragment key={neg}>
                {/* ── Negocio row ── */}
                <tr
                  style={rowStyle}
                  onClick={() => (hasCanales || hasMedios) && toggle(neg)}
                  onMouseEnter={e => (e.currentTarget.style.background = rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = isMediosView ? subRowBg : "transparent")}
                >
                  <td style={{ ...cellBody, fontWeight: 600 }}>
                    <span className="flex items-center gap-1.5">
                      {(hasCanales || hasMedios)
                        ? (isOpen
                            ? <ChevronDown  className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--foreground-subtle)" }} />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--foreground-subtle)" }} />)
                        : <span className="w-3.5" />}
                      {neg}
                    </span>
                  </td>
                  <td style={{ ...cellBody, textAlign: "right", fontWeight: 600, color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>
                    {formatSoles(data.total)}
                  </td>
                  {hasBudget && <>
                    <td style={{ ...cellMuted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {data.presupuesto != null ? formatSoles(data.presupuesto) : "—"}
                    </td>
                    <td style={cellMuted}>
                      {cumpl !== null
                        ? <CumplBar cumpl={cumpl} />
                        : <span style={{ color: "var(--foreground-subtle)", fontSize: "0.75rem" }}>—</span>}
                    </td>
                  </>}
                  {hasPropinas && (
                    <td style={{ ...cellMuted, textAlign: "right", color: "var(--secondary)", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>
                      {data.propinas ? formatSoles(data.propinas) : "—"}
                    </td>
                  )}
                  <td style={{ ...cellMuted, textAlign: "right", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
                    {pct(data.total, grand_total)}
                  </td>
                </tr>

                {/* ── Expanded rows ── */}
                {isOpen && (
                  <>
                    {/* ── Medios de Pago ── */}
                    {isMediosView && data.medios_pago && (() => {
                      const MP: Record<string, { label: string; color: string }> = {
                        efectivo:  { label: "Efectivo",  color: "var(--primary)"   },
                        tarjeta:   { label: "Tarjeta",   color: "#60a5fa"          },
                        otros:     { label: "Otros",     color: "var(--secondary)" },
                        pago_link: { label: "Pago Link", color: "#a78bfa"          },
                        propinas:  { label: "Propinas",  color: "var(--secondary)" },
                      };
                      return Object.entries(MP).map(([key, { label, color }]) => {
                        const amount = data.medios_pago![key] ?? 0;
                        if (amount <= 0) return null;
                        return (
                          <tr key={`${neg}-mp-${key}`} style={{ borderBottom: "1px solid var(--border)", background: subRowBg }}>
                            <td style={{ ...cellMuted, paddingLeft: "2.25rem" }}>
                              <span className="flex items-center gap-1.5"><span className="w-3.5" />{label}</span>
                            </td>
                            <td style={{ padding: "0.4rem 1rem", textAlign: "right", fontWeight: 500, color, fontVariantNumeric: "tabular-nums" }}>
                              {formatSoles(amount)}
                            </td>
                            {hasBudget  && <><td /><td /></>}
                            {hasPropinas && <td />}
                            <td style={{ padding: "0.4rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--foreground-subtle)", fontVariantNumeric: "tabular-nums" }}>
                              {pct(amount, data.total)}
                            </td>
                          </tr>
                        );
                      });
                    })()}

                    {/* ── Canales ── */}
                    {!isMediosView && <>
                      {grouped.salon > 0 && (
                        <tr style={{ borderBottom: "1px solid var(--border)", background: subRowBg }}>
                          <td style={{ ...cellMuted, paddingLeft: "2.25rem" }}>
                            <span className="flex items-center gap-1.5"><span className="w-3.5" />Salón</span>
                          </td>
                          <td style={{ padding: "0.4rem 1rem", textAlign: "right", color: "var(--foreground-muted)", fontVariantNumeric: "tabular-nums" }}>
                            {formatSoles(grouped.salon)}
                          </td>
                          {hasBudget  && <><td /><td /></>}
                          {hasPropinas && <td />}
                          <td style={{ padding: "0.4rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--foreground-subtle)", fontVariantNumeric: "tabular-nums" }}>
                            {pct(grouped.salon, data.total)}
                          </td>
                        </tr>
                      )}

                      {grouped.delivery.total > 0 && (
                        <>
                          <tr
                            style={{ borderBottom: "1px solid var(--border)", background: subRowBg, cursor: "pointer" }}
                            onClick={e => { e.stopPropagation(); toggleDelivery(neg); }}
                            onMouseEnter={e => (e.currentTarget.style.background = rowHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = subRowBg)}
                          >
                            <td style={{ ...cellMuted, paddingLeft: "2.25rem" }}>
                              <span className="flex items-center gap-1.5">
                                {isDelOpen
                                  ? <ChevronDown  className="h-3 w-3 shrink-0" style={{ color: "var(--foreground-subtle)" }} />
                                  : <ChevronRight className="h-3 w-3 shrink-0" style={{ color: "var(--foreground-subtle)" }} />}
                                Delivery
                              </span>
                            </td>
                            <td style={{ padding: "0.4rem 1rem", textAlign: "right", color: "var(--foreground-muted)", fontVariantNumeric: "tabular-nums" }}>
                              {formatSoles(grouped.delivery.total)}
                            </td>
                            {hasBudget  && <><td /><td /></>}
                            {hasPropinas && <td />}
                            <td style={{ padding: "0.4rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--foreground-subtle)", fontVariantNumeric: "tabular-nums" }}>
                              {pct(grouped.delivery.total, data.total)}
                            </td>
                          </tr>

                          {isDelOpen && Object.entries(grouped.delivery.sub)
                            .sort(([, a], [, b]) => b - a)
                            .map(([subCanal, amount]) => (
                              <tr key={`${neg}-delivery-${subCanal}`} style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
                                <td style={{ padding: "0.3rem 1rem 0.3rem 3.5rem", fontSize: "0.75rem", color: "var(--foreground-subtle)" }}>
                                  {subCanal}
                                </td>
                                <td style={{ padding: "0.3rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--foreground-muted)", fontVariantNumeric: "tabular-nums" }}>
                                  {formatSoles(amount)}
                                </td>
                                {hasBudget  && <><td /><td /></>}
                                {hasPropinas && <td />}
                                <td style={{ padding: "0.3rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--foreground-subtle)", fontVariantNumeric: "tabular-nums" }}>
                                  {pct(amount, grouped.delivery.total)}
                                </td>
                              </tr>
                            ))}
                        </>
                      )}

                      {Object.entries(grouped.nombrados).sort(([, a], [, b]) => b - a).map(([canal, amount]) => (
                        <tr key={`${neg}-nom-${canal}`} style={{ borderBottom: "1px solid var(--border)", background: subRowBg }}>
                          <td style={{ ...cellMuted, paddingLeft: "2.25rem" }}>
                            <span className="flex items-center gap-1.5"><span className="w-3.5" />{canal}</span>
                          </td>
                          <td style={{ padding: "0.4rem 1rem", textAlign: "right", color: "var(--foreground-muted)", fontVariantNumeric: "tabular-nums" }}>
                            {formatSoles(amount)}
                          </td>
                          {hasBudget  && <><td /><td /></>}
                          {hasPropinas && <td />}
                          <td style={{ padding: "0.4rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--foreground-subtle)", fontVariantNumeric: "tabular-nums" }}>
                            {pct(amount, data.total)}
                          </td>
                        </tr>
                      ))}

                      {Object.entries(grouped.otros).map(([canal, amount]) => (
                        <tr key={`${neg}-${canal}`} style={{ borderBottom: "1px solid var(--border)", background: subRowBg }}>
                          <td style={{ ...cellMuted, paddingLeft: "2.25rem" }}>
                            <span className="flex items-center gap-1.5"><span className="w-3.5" />{canal}</span>
                          </td>
                          <td style={{ padding: "0.4rem 1rem", textAlign: "right", color: "var(--foreground-muted)", fontVariantNumeric: "tabular-nums" }}>
                            {formatSoles(amount)}
                          </td>
                          {hasBudget  && <><td /><td /></>}
                          {hasPropinas && <td />}
                          <td style={{ padding: "0.4rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--foreground-subtle)", fontVariantNumeric: "tabular-nums" }}>
                            {pct(amount, data.total)}
                          </td>
                        </tr>
                      ))}
                    </>}
                  </>
                )}
              </Fragment>
            );
          })}

          {/* ── Total row ── */}
          <tr style={{
            background: "var(--surface-2)",
            borderTop: "2px solid var(--border-strong)",
            fontWeight: 700,
          }}>
            <td style={{ padding: "0.65rem 1rem", color: "var(--foreground)" }}>Total Cavas Reunidas</td>
            <td style={{ padding: "0.65rem 1rem", textAlign: "right", color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>
              {formatSoles(grand_total)}
            </td>
            {hasBudget && (
              <>
                <td style={{ padding: "0.65rem 1rem", textAlign: "right", color: "var(--foreground-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {formatSoles(negocioList.reduce((s, [, d]) => s + (d.presupuesto || 0), 0))}
                </td>
                <td style={{ padding: "0.65rem 1rem" }}>
                  {(() => {
                    const totalBudget = negocioList.reduce((s, [, d]) => s + (d.presupuesto || 0), 0);
                    return totalBudget > 0
                      ? <CumplBar cumpl={(grand_total / totalBudget) * 100} />
                      : <span style={{ color: "var(--foreground-subtle)", fontSize: "0.75rem" }}>—</span>;
                  })()}
                </td>
              </>
            )}
            {hasPropinas && (
              <td style={{ padding: "0.65rem 1rem", textAlign: "right", color: "var(--secondary)", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>
                {grandPropinas > 0 ? formatSoles(grandPropinas) : "—"}
              </td>
            )}
            <td style={{ padding: "0.65rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--foreground-subtle)" }}>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
