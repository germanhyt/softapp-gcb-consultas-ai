/**
 * Server-side only. Creates model instances dynamically using API keys from config.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { getApiKey, getEnabledModelIds } from "./ai-config";
import { AI_PROVIDERS, type AIProviderInfo } from "./models";

// Re-export for backwards compatibility
export { AI_PROVIDERS, type AIProviderInfo } from "./models";

/**
 * Creates a model instance dynamically using the API key from config (or env fallback).
 */
export function getModel(modelId: string) {
  const info = AI_PROVIDERS[modelId];
  if (!info) {
    const googleKey = getApiKey("google");
    const google = createGoogleGenerativeAI({ apiKey: googleKey || undefined });
    return google("gemini-2.0-flash");
  }

  const apiKey = getApiKey(info.providerKey);

  switch (info.providerKey) {
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: apiKey || undefined });
      return google(modelId as Parameters<typeof google>[0]);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: apiKey || undefined });
      return anthropic(modelId as Parameters<typeof anthropic>[0]);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: apiKey || undefined });
      return openai(modelId as Parameters<typeof openai>[0]);
    }
    case "deepseek": {
      const deepseek = createOpenAI({
        baseURL: "https://api.deepseek.com",
        apiKey: apiKey || undefined,
      });
      return deepseek(modelId as Parameters<typeof deepseek>[0]);
    }
    default: {
      const google = createGoogleGenerativeAI({ apiKey: getApiKey("google") || undefined });
      return google("gemini-2.0-flash");
    }
  }
}

/**
 * Returns only the models that are enabled AND have a valid API key.
 */
export function getEnabledProviderList(): AIProviderInfo[] {
  const enabledIds = getEnabledModelIds();
  return enabledIds
    .map((id) => AI_PROVIDERS[id])
    .filter(Boolean);
}

/**
 * Returns all provider info (for settings page).
 */
export function getProviderList(): AIProviderInfo[] {
  return Object.values(AI_PROVIDERS);
}
