"use client";

import { useState, useRef, useMemo } from "react";
import { formatTextContent } from "@/lib/format-text";
import {
  parseMessageContent,
  hasTableContent,
  type ContentSegment,
} from "@/lib/parse-tables";
import { SortableTable } from "./sortable-table";
import { AutoChart } from "./auto-chart";
import { ExportDropdown } from "./export-dropdown";
import { AlignLeft, Table2, BarChart3, Code2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageContentProps {
  content: string;
  isExpanded?: boolean;
  isStreaming?: boolean;
}

type ViewMode = "text" | "table" | "chart" | "raw";

function SegmentTabs({
  segment,
  isExpanded,
}: {
  segment: ContentSegment;
  isExpanded: boolean;
}) {
  const [activeView, setActiveView] = useState<ViewMode>("table");
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!segment.table) return null;

  const tabs: { id: ViewMode; label: string; icon: typeof AlignLeft }[] = [
    { id: "text", label: "Texto", icon: AlignLeft },
    { id: "table", label: "Tabla", icon: Table2 },
    { id: "raw", label: "SQL/Datos", icon: Code2 },
  ];

  // Show chart tab when there are numeric columns
  if (segment.table.numericColumns.length > 0) {
    tabs.splice(2, 0, { id: "chart", label: "Gráfico", icon: BarChart3 });
  }

  return (
    <div className="my-3" ref={containerRef}>
      {/* Title */}
      {segment.table.title && (
        <p className="text-xs font-semibold text-muted-foreground mb-1">
          {segment.table.title}
        </p>
      )}

      {/* Tab bar + Export */}
      <div className="flex items-center justify-between mb-2 border-b border-slate-200 dark:border-zinc-700 pb-1">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  activeView === tab.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <ExportDropdown
          table={segment.table}
          containerRef={containerRef}
          chartRef={chartRef}
          showPNG={activeView === "chart"}
        />
      </div>

      {/* Content */}
      {activeView === "text" && (
        <div className="overflow-x-auto my-1">
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: formatTextContent(segment.content),
            }}
          />
        </div>
      )}

      {activeView === "table" && <SortableTable table={segment.table} />}

      {activeView === "chart" && segment.table.numericColumns.length > 0 && (
        <AutoChart ref={chartRef} table={segment.table} />
      )}

      {activeView === "raw" && (
        <div className="overflow-x-auto my-1">
          <pre className="bg-slate-100 dark:bg-zinc-700 rounded-md p-3 text-[11px] font-mono text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-zinc-600">
            {segment.content}
          </pre>
        </div>
      )}
    </div>
  );
}

export function MessageContent({
  content,
  isExpanded = false,
  isStreaming = false,
}: MessageContentProps) {
  const safeContent = content ?? "";

  const segments = useMemo(() => {
    // During streaming, don't try to parse tables (content is incomplete)
    if (isStreaming) return null;
    if (!safeContent || !hasTableContent(safeContent)) return null;
    return parseMessageContent(safeContent);
  }, [safeContent, isStreaming]);

  // Streaming or no tables: render as plain formatted text
  if (!segments) {
    return (
      <span
        dangerouslySetInnerHTML={{
          __html: formatTextContent(safeContent),
        }}
      />
    );
  }

  // Multi-segment rendering with tabs for tables
  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.type === "text") {
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{
                __html: formatTextContent(segment.content),
              }}
            />
          );
        }

        return (
          <SegmentTabs
            key={idx}
            segment={segment}
            isExpanded={isExpanded}
          />
        );
      })}
    </>
  );
}
