"use client";

import { useState } from "react";
import { PlotlyChart } from "@/components/charts/PlotlyChart";

const PALETTE = [
  "#059669", "#2563eb", "#7c3aed", "#d97706",
  "#dc2626", "#db2777", "#0d9488", "#ea580c",
  "#65a30d", "#0284c7", "#9333ea", "#b45309",
];

type ChartType = "bar" | "line" | "area";

interface NegocioData { total: number; presupuesto?: number; }

interface MonthData {
  month: string;
  label: string;
  negocios: Record<string, NegocioData>;
  total: number;
  presupuesto?: number;
}

interface MonthlyChartProps {
  months: MonthData[];
}

const TOGGLE_TYPES: { id: ChartType; label: string }[] = [
  { id: "bar",  label: "Barras" },
  { id: "line", label: "Líneas" },
  { id: "area", label: "Área"   },
];

export function MonthlyChart({ months }: MonthlyChartProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");

  if (!months.length) return null;

  const negocios = Array.from(
    new Set(months.flatMap((m) => Object.keys(m.negocios)))
  ).sort((a, b) => {
    const ta = months.reduce((s, m) => s + (m.negocios[a]?.total || 0), 0);
    const tb = months.reduce((s, m) => s + (m.negocios[b]?.total || 0), 0);
    return tb - ta;
  });

  const xLabels = months.map((m) => m.label.split(" ")[0]);

  // Build Plotly traces
  const plotData = negocios.map((neg, i) => {
    const color = PALETTE[i % PALETTE.length];
    const y = months.map((m) => m.negocios[neg]?.total || 0);

    if (chartType === "bar") {
      return { type: "bar", name: neg, x: xLabels, y, marker: { color }, stackgroup: undefined };
    } else if (chartType === "line") {
      return {
        type: "scatter", mode: "lines+markers", name: neg,
        x: xLabels, y,
        line: { color, width: 2.5 },
        marker: { color, size: 6 },
      };
    } else {
      // area — stacked
      return {
        type: "scatter", mode: "lines", name: neg,
        x: xLabels, y,
        stackgroup: "one",
        line: { color, width: 1.5 },
        fillcolor: color + "66",
      };
    }
  });

  const layout = {
    barmode: "stack",
    height: 280,
    margin: { t: 16, r: 16, l: 70, b: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    showlegend: negocios.length > 1,
    legend: { orientation: "h", y: -0.18, font: { size: 11 } },
    font: { family: "Inter, sans-serif", size: 12, color: "#1e293b" },
    xaxis: {
      gridcolor: "rgba(148,163,184,0.2)",
      tickfont: { size: 12, color: "#374151" },
      zeroline: false,
    },
    yaxis: {
      gridcolor: "rgba(148,163,184,0.2)",
      tickprefix: "S/ ",
      tickformat: ".2s",
      zeroline: false,
      tickfont: { size: 11, color: "#374151" },
    },
  };

  const config = {
    displaylogo: false,
    responsive: true,
    modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"],
    toImageButtonOptions: { format: "png", scale: 2 },
  };

  return (
    <div>
      {/* Chart type toggle */}
      <div className="flex items-center gap-1 mb-3">
        {TOGGLE_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setChartType(t.id)}
            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
              chartType === t.id
                ? "bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-700 dark:border-slate-200"
                : "border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700"
            }`}
          >{t.label}</button>
        ))}
      </div>

      <PlotlyChart
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: "100%", height: 280 }}
        useResizeHandler
      />
    </div>
  );
}
