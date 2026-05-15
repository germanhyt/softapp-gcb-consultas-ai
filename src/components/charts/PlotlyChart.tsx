"use client";

/**
 * Dynamic Plotly wrapper — loads only on the client (no SSR).
 * Usage:
 *   import { PlotlyChart } from "@/components/charts/PlotlyChart";
 *   <PlotlyChart data={[...]} layout={{...}} />
 */
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PlotlyChart = dynamic<any>(
  () => import("react-plotly.js"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center" style={{ height: 280 }}>
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    ),
  }
);
