"use client";

import { useGlobalChat } from "@/contexts/chat-context";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { cn } from "@/lib/utils";

export function ModelSelector() {
  const { selectedModel, setSelectedModel } = useGlobalChat();
  const providers = Object.values(AI_PROVIDERS);

  return (
    <select
      value={selectedModel}
      onChange={(e) => setSelectedModel(e.target.value)}
      className={cn(
        "text-[10px] sm:text-xs bg-white/20 border border-white/30 rounded-md px-1.5 py-0.5",
        "focus:outline-none focus:ring-1 focus:ring-white/50",
        "cursor-pointer text-white/90"
      )}
      title="Cambiar modelo de IA"
    >
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.icon} {p.name}
        </option>
      ))}
    </select>
  );
}
