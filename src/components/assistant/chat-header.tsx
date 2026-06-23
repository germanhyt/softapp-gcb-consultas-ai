"use client";

import type { ReactNode } from "react";
import { Bot } from "lucide-react";
import { COMPANY_NAME } from "@/lib/config/brand";
import { ModeSelector } from "./mode-selector";
import { ModelSelector } from "./model-selector";

interface ChatHeaderProps {
  compact?: boolean;
  actions: ReactNode;
}

export function ChatHeader({ compact = false, actions }: ChatHeaderProps) {
  return (
    <div
      className="shrink-0"
      style={{
        background: "linear-gradient(135deg, #1a2e1c 0%, #162518 100%)",
        borderBottom: "1px solid rgba(56,209,73,0.20)",
      }}
    >
      <div
        className={`flex items-center justify-between gap-2 ${compact ? "px-3 pt-2.5 pb-1" : "px-3 sm:px-6 pt-3 sm:pt-4 pb-1"}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`flex shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-sm ${
              compact ? "h-8 w-8 sm:h-9 sm:w-9" : "h-9 w-9 sm:h-11 sm:w-11"
            }`}
          >
            <Bot className={compact ? "h-4 w-4 sm:h-5 sm:w-5" : "h-5 w-5 sm:h-6 sm:w-6"} />
          </div>
          <div className="min-w-0">
            <h3
              className={`font-semibold text-white truncate ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}
              title={`Asistente ${COMPANY_NAME}`}
            >
              <span className="sm:hidden">Asistente</span>
              <span className="hidden sm:inline">{`Asistente ${COMPANY_NAME}`}</span>
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">{actions}</div>
      </div>

      <div
        className={`flex items-center gap-2 ${compact ? "px-3 pb-2.5" : "px-3 sm:px-6 pb-3 sm:pb-4"}`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
        </span>
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <ModeSelector />
          <ModelSelector />
        </div>
      </div>
    </div>
  );
}
