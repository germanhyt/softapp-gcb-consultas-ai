"use client";

import { PlotlyChart } from "@/components/charts/PlotlyChart";
import { COLUMN_CATEGORIES, MEDIO_PAGO_CATEGORIES } from "@/lib/config/column-rules";

// Category display order + colors (matches column-rules palette)
const SHOW_CATS = [...MEDIO_PAGO_CATEGORIES, "propinas"];

interface NegocioMedios {
  negocio: string;
  medios_pago: Record<string, number>;
}

interface MediosPagoChartProps {
  negocios: NegocioMedios[];
}

export function MediosPagoChart({ negocios }: MediosPagoChartProps) {
  if (!negocios.length) return null;

  // Build one trace per category (stacked bar per negocio)
  const xLabels = negocios.map((n) => n.negocio);

  const traces = SHOW_CATS.map((catKey) => {
    const def = COLUMN_CATEGORIES[catKey];
    const y = negocios.map((n) => n.medios_pago[catKey] ?? 0);
    if (y.every((v) => v === 0)) return null;
    return {
      type: "bar",
      name: def?.label ?? catKey,
      x: xLabels,
      y,
      marker: { color: def?.color ?? "#94a3b8" },
    };
  }).filter(Boolean);

  if (!traces.length) return null;

  const layout = {
    barmode: "stack",
    height: 260,
    margin: { t: 16, r: 16, l: 70, b: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    showlegend: true,
    legend: { orientation: "h", y: -0.22, font: { size: 10 } },
    font: { family: "Inter, sans-serif", size: 12, color: "#1e293b" },
    xaxis: { gridcolor: "rgba(148,163,184,0.2)", tickfont: { size: 12, color: "#374151" }, zeroline: false },
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
    modeBarButtonsToRemove: ["select2d", "lasso2d"],
    toImageButtonOptions: { format: "png", scale: 2 },
  };

  return (
    <PlotlyChart
      data={traces}
      layout={layout}
      config={config}
      style={{ width: "100%", height: 260 }}
      useResizeHandler
    />
  );
}
