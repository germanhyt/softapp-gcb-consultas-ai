"use client";

import { forwardRef, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ParsedTable } from "@/lib/parse-tables";
import { parseNumericValue } from "@/lib/parse-tables";

interface AutoChartProps {
  table: ParsedTable;
}

const COLORS = [
  "#059669", // emerald-600
  "#0891b2", // cyan-600
  "#7c3aed", // violet-600
  "#dc2626", // red-600
  "#ea580c", // orange-600
  "#2563eb", // blue-600
  "#ca8a04", // yellow-600
  "#db2777", // pink-600
];

function detectChartType(
  table: ParsedTable
): "bar" | "line" | "pie" {
  if (table.numericColumns.length === 0) return "bar";

  const firstCol = table.headers[0]?.toLowerCase() || "";
  const isDateLike =
    /fecha|date|dia|día|mes|month|semana|week|hora|hour|periodo|año|year/i.test(
      firstCol
    );

  if (isDateLike && table.rows.length > 3) return "line";
  if (
    table.numericColumns.length === 1 &&
    table.rows.length <= 8 &&
    !isDateLike
  )
    return "pie";

  return "bar";
}

export const AutoChart = forwardRef<HTMLDivElement, AutoChartProps>(
  function AutoChart({ table }, ref) {
    const chartType = useMemo(() => detectChartType(table), [table]);

    const { data, numericHeaders } = useMemo(() => {
      const labelColIdx = table.numericColumns.includes(0) ? -1 : 0;
      const numCols =
        labelColIdx === 0
          ? table.numericColumns.filter((i) => i !== 0)
          : table.numericColumns;

      const headers = numCols.map((i) => table.headers[i]);

      const chartData = table.rows.map((row) => {
        const entry: Record<string, string | number> = {
          name: labelColIdx >= 0 ? row[labelColIdx] || "" : `#${table.rows.indexOf(row) + 1}`,
        };
        for (const colIdx of numCols) {
          const val = parseNumericValue(row[colIdx] || "0");
          entry[table.headers[colIdx]] = val ?? 0;
        }
        return entry;
      });

      return { data: chartData, numericHeaders: headers };
    }, [table]);

    if (data.length === 0 || numericHeaders.length === 0) {
      return (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          No hay datos numericos para graficar
        </div>
      );
    }

    const height = Math.max(250, Math.min(400, data.length * 30));

    return (
      <div ref={ref} className="my-2 p-3 bg-background rounded-lg border">
        <ResponsiveContainer width="100%" height={height}>
          {chartType === "pie" ? (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey={numericHeaders[0]}
                nameKey="name"
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={data.length > 10 ? -45 : 0}
                textAnchor={data.length > 10 ? "end" : "middle"}
                height={data.length > 10 ? 60 : 30}
              />
              <YAxis tick={{ fontSize: 11 }} width={60} />
              <Tooltip />
              <Legend />
              {numericHeaders.map((header, idx) => (
                <Line
                  key={header}
                  type="monotone"
                  dataKey={header}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={data.length > 6 ? -45 : 0}
                textAnchor={data.length > 6 ? "end" : "middle"}
                height={data.length > 6 ? 80 : 30}
              />
              <YAxis tick={{ fontSize: 11 }} width={60} />
              <Tooltip />
              <Legend />
              {numericHeaders.map((header, idx) => (
                <Bar
                  key={header}
                  dataKey={header}
                  fill={COLORS[idx % COLORS.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }
);
