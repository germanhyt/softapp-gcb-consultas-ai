"use client";

import { useState } from "react";
import { useGlobalChat } from "@/contexts/chat-context";
import { CHAT_MODES } from "@/lib/ai/chat-modes";

const MODE_COLORS = {
  auto: "#94a3b8",
  toteat: "#38d149",
} as const;

export function ModeSelector() {
  const { chatMode, setChatMode } = useGlobalChat();
  const [open, setOpen] = useState(false);
  const current = CHAT_MODES.find((m) => m.id === chatMode) ?? CHAT_MODES[0];
  const accentColor = MODE_COLORS[current.id];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-md transition-all duration-150"
        style={{
          background: chatMode === "toteat" ? "rgba(56,209,73,0.20)" : "rgba(255,255,255,0.10)",
          border: chatMode === "toteat" ? "1px solid rgba(56,209,73,0.35)" : "1px solid rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.90)",
        }}
        title="Modo de consulta"
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            chatMode === "toteat" ? "rgba(56,209,73,0.28)" : "rgba(255,255,255,0.18)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background =
            chatMode === "toteat" ? "rgba(56,209,73,0.20)" : "rgba(255,255,255,0.10)";
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />
        <span>{current.shortLabel}</span>
        <svg
          className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1.5 z-[61] min-w-[220px] rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-strong)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.50)",
            }}
          >
            <div
              className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest"
              style={{ color: "var(--foreground-subtle)", borderBottom: "1px solid var(--border)" }}
            >
              Modo de consulta
            </div>
            {CHAT_MODES.map((mode) => {
              const isSelected = mode.id === chatMode;
              const color = MODE_COLORS[mode.id];
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    setChatMode(mode.id);
                    setOpen(false);
                  }}
                  className="w-full flex flex-col items-start gap-0.5 px-3 py-2.5 text-xs transition-colors duration-100 text-left"
                  style={{
                    background: isSelected ? "rgba(56,209,73,0.10)" : "transparent",
                    color: isSelected ? "var(--primary)" : "var(--foreground-muted)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--surface-3)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span className="flex items-center gap-2 w-full font-medium">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    {mode.label}
                    {isSelected && (
                      <span
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--primary)" }}
                      />
                    )}
                  </span>
                  <span className="text-[10px] pl-3.5 opacity-80">{mode.description}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
