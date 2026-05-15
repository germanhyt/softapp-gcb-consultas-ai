/**
 * Client-safe model metadata. No server-only imports here.
 * Used by model-selector.tsx, settings page, and other client components.
 */

export type ProviderKey = "google" | "anthropic" | "openai" | "deepseek";

export interface AIProviderInfo {
  id: string;
  name: string;
  provider: string;
  providerKey: ProviderKey;
  icon: string;
  maxTokens: number;
}

export const AI_PROVIDERS: Record<string, AIProviderInfo> = {
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    providerKey: "google",
    icon: "G",
    maxTokens: 32768,
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    providerKey: "google",
    icon: "G",
    maxTokens: 32768,
  },
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    providerKey: "google",
    icon: "G",
    maxTokens: 32768,
  },
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    providerKey: "anthropic",
    icon: "C",
    maxTokens: 32768,
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    providerKey: "openai",
    icon: "O",
    maxTokens: 16384,
  },
  "deepseek-chat": {
    id: "deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    providerKey: "deepseek",
    icon: "D",
    maxTokens: 32768,
  },
  "deepseek-reasoner": {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    providerKey: "deepseek",
    icon: "D",
    maxTokens: 32768,
  },
};
