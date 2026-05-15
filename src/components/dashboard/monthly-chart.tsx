"use client";

import { useState } from "react";
import { PlotlyChart } from "@/components/charts/PlotlyChart";

// Refugio-aligned palette (vivid, dark-mode friendly)
const PALETTE = [
  "#38D149", "#60a5fa", "#a78bfa", "#FF9F43",
  "#D65454", "#f472b6", "#2dd4bf", "#fb923c",
  "#a3e635", "#38bdf8", "#c084fc", "#fbbf24",
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

interface MonthlyChartProps { months: MonthData[]; }

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

  const plotData = negocios.map((neg, i) => {
    const color = PALETTE[i % PALETTE.length];
    const y = months.map((m) => m.negocios[neg]?.total || 0);

    if (chartType === "bar") {
      return { type: "bar", name: neg, x: xLabels, y, marker: { color } };
    } else if (chartType === "line") {
      return {
        type: "scatter", mode: "lines+markers", name: neg,
        x: xLabels, y,
        line: { color, width: 2.5 },
        marker: { color, size: 6 },
      };
    } else {
      return {
        type: "scatter", mode: "lines", name: neg,
        x: xLabels, y,
        stackgroup: "one",
        line: { color, width: 1.5 },
        fillcolor: color + "55",
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
    legend: { orientation: "h", y: -0.22, font: { size: 11, color: "#9DA89D" } },
    font: { family: "var(--font-hanken, Hanken Grotesk, sans-serif)", size: 12, color: "#9DA89D" },
    xaxis: {
      gridcolor: "rgba(113,122,109,0.15)",
      tickfont: { size: 12, color: "#9DA89D" },
      zeroline: false,
    },
    yaxis: {
      gridcolor: "rgba(113,122,109,0.15)",
      tickprefix: "S/ ",
      tickformat: ".2s",
      zeroline: false,
      tickfont: { size: 11, color: "#9DA89D" },
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
            className="text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all duration-150"
            style={
              chartType === t.id
                ? {
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                    borderColor: "var(--primary)",
                    boxShadow: "0 0 10px rgba(56,209,73,0.30)",
                  }
                : {
                    background: "var(--surface-2)",
                    borderColor: "var(--border-strong)",
                    color: "var(--foreground-muted)",
                  }
            }
          >
            {t.label}
          </button>
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
