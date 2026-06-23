"use client";

import { useEffect, useState } from "react";
import { useGlobalChat } from "@/contexts/chat-context";
import { AI_PROVIDERS, resolveModelId, type AIProviderInfo, type ProviderKey } from "@/lib/ai/models";

interface ModelsConfig {
  models: Record<string, boolean>;
}

// Provider accent colors
const PROVIDER_COLORS: Record<ProviderKey, string> = {
  google:    "#4285F4",
  anthropic: "#D4956A",
  openai:    "#74AA9C",
  deepseek:  "#4A90D9",
};

export function ModelSelector() {
  const { selectedModel, setSelectedModel } = useGlobalChat();
  const [enabledModels, setEnabledModels] = useState<AIProviderInfo[]>(
    Object.values(AI_PROVIDERS)
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const resolved = resolveModelId(selectedModel);
    if (resolved !== selectedModel) {
      setSelectedModel(resolved);
    }
  }, [selectedModel, setSelectedModel]);

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((data: ModelsConfig) => {
        if (data?.models) {
          const filtered = Object.values(AI_PROVIDERS).filter(
            (p) => data.models[p.id] !== false
          );
          if (filtered.length > 0) {
            setEnabledModels(filtered);
            if (!filtered.some((m) => m.id === selectedModel)) {
              setSelectedModel(filtered[0].id);
            }
          }
        }
      })
      .catch(() => {});
  }, [selectedModel, setSelectedModel]);

  const current = enabledModels.find((m) => m.id === selectedModel) ?? enabledModels[0];
  const accentColor = current ? PROVIDER_COLORS[current.providerKey] : "var(--primary)";

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-md transition-all duration-150"
        style={{
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.90)",
        }}
        title="Cambiar modelo de IA"
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
      >
        {/* Provider dot */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: accentColor }}
        />
        <span>{current?.icon} {current?.name ?? "Modelo"}</span>
        {/* Chevron */}
        <svg
          className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1.5 z-[61] min-w-[180px] rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
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
              Modelo de IA
            </div>
            {enabledModels.map((model) => {
              const isSelected = model.id === selectedModel;
              const color = PROVIDER_COLORS[model.providerKey];
              return (
                <button
                  key={model.id}
                  onClick={() => { setSelectedModel(model.id); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors duration-100 text-left"
                  style={{
                    background: isSelected ? "rgba(56,209,73,0.10)" : "transparent",
                    color: isSelected ? "var(--primary)" : "var(--foreground-muted)",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--surface-3)"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-black text-white"
                    style={{ background: color }}
                  >
                    {model.icon}
                  </span>
                  <span className="flex-1 font-medium">{model.name}</span>
                  {isSelected && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
