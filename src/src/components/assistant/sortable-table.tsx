"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ParsedTable } from "@/lib/parse-tables";
import { parseNumericValue } from "@/lib/parse-tables";

interface SortableTableProps {
  table: ParsedTable;
}

export function SortableTable({ table }: SortableTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (sortCol === null) return table.rows;

    return [...table.rows].sort((a, b) => {
      const aVal = a[sortCol] || "";
      const bVal = b[sortCol] || "";

      // Try numeric comparison
      const aNum = parseNumericValue(aVal);
      const bNum = parseNumericValue(bVal);

      if (aNum !== null && bNum !== null) {
        return sortDir === "asc" ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const cmp = aVal.localeCompare(bVal, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [table.rows, sortCol, sortDir]);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortCol(null);
        setSortDir("asc");
      }
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const isNumeric = (colIdx: number) => table.numericColumns.includes(colIdx);

  return (
    <div className="overflow-x-auto my-2 rounded-md border border-slate-200 dark:border-zinc-700 shadow-sm">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr>
            {table.headers.map((header, i) => (
              <th
                key={i}
                onClick={() => handleSort(i)}
                className="border-b border-slate-200 dark:border-zinc-700 px-3 py-2 bg-slate-100 dark:bg-zinc-800 font-semibold text-left text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span className={isNumeric(i) ? "text-right flex-1" : ""}>
                    {header}
                  </span>
                  {sortCol === i ? (
                    sortDir === "asc" ? (
                      <ArrowUp className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-emerald-600" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={
                rowIdx % 2 === 0
                  ? "bg-white dark:bg-zinc-800"
                  : "bg-slate-50 dark:bg-zinc-700/60"
              }
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className={`border-b border-slate-100 dark:border-zinc-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 ${
                    isNumeric(cellIdx) ? "text-right tabular-nums" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-700">
        {sortedRows.length} registro{sortedRows.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
