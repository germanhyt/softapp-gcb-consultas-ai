"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Image, Loader2 } from "lucide-react";
import type { ParsedTable } from "@/lib/parse-tables";
import { cn } from "@/lib/utils";

type ExportFormat = "excel" | "pdf" | "png";

interface ExportDropdownProps {
  table: ParsedTable;
  containerRef: React.RefObject<HTMLElement | null>;
  chartRef?: React.RefObject<HTMLElement | null>;
  showPNG?: boolean;
}

export function ExportDropdown({
  table,
  containerRef,
  chartRef,
  showPNG = false,
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const { exportToExcel, exportToPDF, exportToPNG } = await import(
        "@/lib/export-utils"
      );
      const title = table.title || "datos";

      switch (format) {
        case "excel":
          await exportToExcel(table, title);
          break;
        case "pdf":
          if (containerRef.current) {
            await exportToPDF(containerRef.current, title);
          }
          break;
        case "png":
          if (chartRef?.current) {
            await exportToPNG(chartRef.current, title);
          } else if (containerRef.current) {
            await exportToPNG(containerRef.current, title);
          }
          break;
      }
    } catch (error) {
      console.error("[Export] Error:", error);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const options: {
    format: ExportFormat;
    label: string;
    icon: typeof Download;
    show: boolean;
  }[] = [
    { format: "excel", label: "Excel (.xlsx)", icon: FileSpreadsheet, show: true },
    { format: "pdf", label: "PDF", icon: FileText, show: true },
    { format: "png", label: "PNG", icon: Image, show: showPNG },
  ];

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
          isOpen
            ? "bg-emerald-600 text-white border-emerald-600"
            : "border-slate-300 dark:border-zinc-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-slate-200"
        )}
        title="Exportar datos"
      >
        <Download className="h-3.5 w-3.5" />
        Exportar
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[160px] rounded-lg border bg-popover p-1.5 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          {options
            .filter((o) => o.show)
            .map((opt) => {
              const Icon = opt.icon;
              const isExporting = exporting === opt.format;
              return (
                <button
                  key={opt.format}
                  onClick={() => handleExport(opt.format)}
                  disabled={isExporting}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-md text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors",
                    isExporting && "opacity-50"
                  )}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  {opt.label}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
