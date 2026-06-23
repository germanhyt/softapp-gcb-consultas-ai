export type ChatMode = "auto" | "toteat";

export const CHAT_MODE_STORAGE_KEY = "refugio_chat_mode";

export interface ChatModeOption {
  id: ChatMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const CHAT_MODES: ChatModeOption[] = [
  {
    id: "auto",
    label: "General",
    shortLabel: "Auto",
    description: "Conciliación, ventas BigQuery, estacionamiento y flujo",
  },
  {
    id: "toteat",
    label: "Toteat",
    shortLabel: "Toteat",
    description: "Ventas en vivo desde API Toteat (cierres, meseros, cruce interno)",
  },
];

export function isChatMode(value: unknown): value is ChatMode {
  return value === "auto" || value === "toteat";
}
