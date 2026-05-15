"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { COLUMN_CATEGORIES, MEDIO_PAGO_CATEGORIES, formatSoles } from "@/lib/config/column-rules";

interface MedioPagoChartProps {
  aggregated: Record<string, number>;
}

export function MedioPagoChart({ aggregated }: MedioPagoChartProps) {
  const data = MEDIO_PAGO_CATEGORIES
    .map((cat) => ({
      name: COLUMN_CATEGORIES[cat]?.label || cat,
      value: aggregated[cat] || 0,
      color: COLUMN_CATEGORIES[cat]?.color || "#94a3b8",
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!data.length) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
      <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2 shadow text-xs">
        <p className="font-semibold" style={{ color: item.payload.color }}>{item.name}</p>
        <p>{formatSoles(item.value)}</p>
        <p className="text-slate-500">{((item.value / total) * 100).toFixed(1)}%</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={85}
          innerRadius={45}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
