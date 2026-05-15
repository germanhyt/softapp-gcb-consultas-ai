import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

export interface AIProviderInfo {
  id: string;
  name: string;
  provider: string;
  icon: string;
  maxTokens: number;
}

export const AI_PROVIDERS: Record<string, AIProviderInfo> = {
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    icon: "G",
    maxTokens: 32768,
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    icon: "G",
    maxTokens: 32768,
  },
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    icon: "G",
    maxTokens: 32768,
  },
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    icon: "C",
    maxTokens: 32768,
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    icon: "O",
    maxTokens: 16384,
  },
};

export function getModel(modelId: string) {
  switch (modelId) {
    case "gemini-2.0-flash":
      return google("gemini-2.0-flash");
    case "gemini-2.5-flash":
      // Gemini 2.5 Flash is a thinking model - disable thinking to avoid token budget issues
      return google("gemini-2.5-flash");
    case "gemini-2.5-pro":
      return google("gemini-2.5-pro");
    case "claude-sonnet-4-6":
      return anthropic("claude-sonnet-4-6");
    case "gpt-4o":
      return openai("gpt-4o");
    default:
      return google("gemini-2.0-flash");
  }
}

export function getProviderList(): AIProviderInfo[] {
  return Object.values(AI_PROVIDERS);
}
