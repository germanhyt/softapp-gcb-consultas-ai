"use client";

import { useMemo, useState } from "react";
import { PlotlyChart } from "@/components/charts/PlotlyChart";
import { COLUMN_CATEGORIES, MEDIO_PAGO_CATEGORIES } from "@/lib/config/column-rules";
import { formatChartSolesExact, PLOTLY_SOLES_TICKFORMAT } from "@/lib/config/chart-format";

const SHOW_CATS = [...MEDIO_PAGO_CATEGORIES];

type ChartView = "composition" | "amounts" | "treemap";

const VIEW_OPTIONS: { id: ChartView; label: string }[] = [
  { id: "composition", label: "Composición %" },
  { id: "amounts", label: "Montos S/" },
  { id: "treemap", label: "Mapa" },
];

interface NegocioMedios {
  negocio: string;
  medios_pago: Record<string, number>;
}

interface MediosPagoChartProps {
  negocios: NegocioMedios[];
}

function negocioTotal(medios: Record<string, number>): number {
  return SHOW_CATS.reduce((s, k) => s + (medios[k] ?? 0), 0);
}

function buildStackedBarTraces(
  sorted: NegocioMedios[],
  mode: "composition" | "amounts",
) {
  const yLabels = sorted.map((n) => n.negocio);
  const totals = sorted.map((n) => negocioTotal(n.medios_pago));

  return SHOW_CATS.map((catKey) => {
    const def = COLUMN_CATEGORIES[catKey];
    const raw = sorted.map((n) => n.medios_pago[catKey] ?? 0);
    if (raw.every((v) => v === 0)) return null;

    const x =
      mode === "composition"
        ? raw.map((v, i) => (totals[i] > 0 ? (v / totals[i]) * 100 : 0))
        : raw;

    return {
      type: "bar" as const,
      orientation: "h" as const,
      name: def?.label ?? catKey,
      y: yLabels,
      x,
      marker: { color: def?.color ?? "#94a3b8", line: { width: 0 } },
      hovertemplate:
        `<b>%{y}</b><br>` +
        `${def?.label ?? catKey}: %{customdata}<br>` +
        `<extra></extra>`,
      customdata: raw.map((v, i) => {
        const pct = totals[i] > 0 ? ((v / totals[i]) * 100).toFixed(1) : "0.0";
        return `${formatChartSolesExact(v)} (${pct}%)`;
      }),
    };
  }).filter(Boolean);
}

function buildTreemapTrace(sorted: NegocioMedios[]) {
  const labels: string[] = [];
  const parents: string[] = [];
  const values: number[] = [];
  const colors: string[] = [];

  for (const { negocio, medios_pago } of sorted) {
    const slices = SHOW_CATS
      .map((cat) => ({
        cat,
        value: medios_pago[cat] ?? 0,
        color: COLUMN_CATEGORIES[cat]?.color ?? "#94a3b8",
        label: COLUMN_CATEGORIES[cat]?.label ?? cat,
      }))
      .filter((s) => s.value > 0);

    if (!slices.length) continue;

    labels.push(negocio);
    parents.push("");
    values.push(0);
    colors.push("rgba(56,209,73,0.25)");

    for (const s of slices) {
      labels.push(s.label);
      parents.push(negocio);
      values.push(s.value);
      colors.push(s.color);
    }
  }

  if (labels.length <= 1) return null;

  return {
    type: "treemap" as const,
    labels,
    parents,
    values,
    branchvalues: "total" as const,
    textinfo: "label+percent parent" as const,
    textfont: { size: 11, color: "#E8F0E6" },
    marker: {
      colors,
      line: { width: 2, color: "rgba(15,20,15,0.85)" },
    },
    hovertemplate:
      "<b>%{label}</b><br>" +
      "%{customdata}<br>" +
      "%{percentParent:.1%} del padre<extra></extra>",
    customdata: values.map((v) => (v > 0 ? formatChartSolesExact(v) : "")),
  };
}

export function MediosPagoChart({ negocios }: MediosPagoChartProps) {
  const [view, setView] = useState<ChartView>("composition");

  const sorted = useMemo(
    () =>
      [...negocios]
        .filter((n) => negocioTotal(n.medios_pago) > 0)
        .sort((a, b) => negocioTotal(b.medios_pago) - negocioTotal(a.medios_pago)),
    [negocios],
  );

  const globalTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const n of sorted) {
      for (const cat of SHOW_CATS) {
        const v = n.medios_pago[cat] ?? 0;
        if (v > 0) acc[cat] = (acc[cat] || 0) + v;
      }
    }
    return Object.entries(acc)
      .map(([cat, total]) => ({
        cat,
        total: Math.round(total * 100) / 100,
        label: COLUMN_CATEGORIES[cat]?.label ?? cat,
        color: COLUMN_CATEGORIES[cat]?.color ?? "#94a3b8",
      }))
      .sort((a, b) => b.total - a.total);
  }, [sorted]);

  const portfolioTotal = useMemo(
    () => globalTotals.reduce((s, g) => s + g.total, 0),
    [globalTotals],
  );

  if (!sorted.length) return null;

  const barHeight = Math.max(340, sorted.length * 40 + 120);
  const yLabels = sorted.map((n) => n.negocio);
  const totals = sorted.map((n) => negocioTotal(n.medios_pago));

  const barTraces =
    view === "treemap" ? [] : buildStackedBarTraces(sorted, view);

  const treemapTrace = view === "treemap" ? buildTreemapTrace(sorted) : null;

  const plotData =
    view === "treemap"
      ? treemapTrace
        ? [treemapTrace]
        : []
      : barTraces;

  if (!plotData.length) return null;

  const layout =
    view === "treemap"
      ? {
          height: 420,
          margin: { t: 8, r: 8, l: 8, b: 8 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: {
            family: "var(--font-hanken, Hanken Grotesk, sans-serif)",
            size: 12,
            color: "#9DA89D",
          },
        }
      : {
          barmode: "stack" as const,
          height: barHeight,
          margin: { t: 12, r: totals.some((t) => t > 0) ? 88 : 24, l: 8, b: 48 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          showlegend: true,
          legend: {
            orientation: "h" as const,
            y: 1.06,
            x: 0,
            font: { size: 11, color: "#9DA89D" },
            bgcolor: "rgba(0,0,0,0)",
          },
          font: {
            family: "var(--font-hanken, Hanken Grotesk, sans-serif)",
            size: 12,
            color: "#9DA89D",
          },
          xaxis: {
            gridcolor: "rgba(113,122,109,0.12)",
            zeroline: false,
            tickfont: { size: 11, color: "#9DA89D" },
            ...(view === "composition"
              ? {
                  range: [0, 100],
                  ticksuffix: "%",
                  title: { text: "Participación", font: { size: 11, color: "#717A6D" } },
                }
              : {
                  tickprefix: "S/ ",
                  tickformat: PLOTLY_SOLES_TICKFORMAT,
                  separatethousands: true,
                  title: { text: "Monto (S/)", font: { size: 11, color: "#717A6D" } },
                }),
          },
          yaxis: {
            automargin: true,
            tickfont: { size: 12, color: "#E8F0E6" },
            gridcolor: "rgba(0,0,0,0)",
            zeroline: false,
          },
          annotations:
            view === "amounts"
              ? totals.map((total, i) => ({
                  x: total,
                  y: yLabels[i],
                  xanchor: "left" as const,
                  xshift: 8,
                  text: formatChartSolesExact(total),
                  showarrow: false,
                  font: { size: 10, color: "#38D149" },
                }))
              : [],
        };

  const config = {
    displaylogo: false,
    responsive: true,
    modeBarButtonsToRemove: ["select2d", "lasso2d"],
    toImageButtonOptions: { format: "png", scale: 2 },
  };

  const chartHeight = view === "treemap" ? 420 : barHeight;

  return (
    <div className="space-y-4">
      {/* Resumen global */}
      <div
        className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--foreground-subtle)" }}
          >
            Total medios de pago
          </p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "#38D149" }}>
            {formatChartSolesExact(portfolioTotal)}
          </p>
        </div>
        <div className="h-8 w-px hidden sm:block" style={{ background: "var(--border)" }} />
        <div className="flex flex-wrap gap-2 flex-1">
          {globalTotals.slice(0, 6).map((g) => {
            const pct =
              portfolioTotal > 0
                ? ((g.total / portfolioTotal) * 100).toFixed(1)
                : "0.0";
            return (
              <span
                key={g.cat}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg tabular-nums"
                style={{
                  background: `${g.color}18`,
                  border: `1px solid ${g.color}44`,
                  color: g.color,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: g.color }}
                />
                {g.label}
                <span style={{ color: "var(--foreground-muted)" }}>
                  {pct}%
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Selector de vista */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
          BigQuery · FormaPagoModificado · comparación por negocio
        </p>
        <div className="flex items-center gap-1">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setView(opt.id)}
              className="text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all duration-150"
              style={
                view === opt.id
                  ? {
                      background: "#a78bfa",
                      color: "#fff",
                      borderColor: "#a78bfa",
                      boxShadow: "0 0 10px rgba(167,139,250,0.35)",
                    }
                  : {
                      background: "var(--surface-2)",
                      borderColor: "var(--border-strong)",
                      color: "var(--foreground-muted)",
                    }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <PlotlyChart
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: "100%", height: chartHeight }}
        useResizeHandler
      />
    </div>
  );
}
