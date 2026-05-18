import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import type { ProviderKey } from "./models";

export type { ProviderKey };

export interface AIConfig {
  providers: Record<ProviderKey, { apiKey: string }>;
  models: Record<string, boolean>;
}

/**
 * Resolves the app root from process.cwd() (reliable for Next.js) instead of
 * import.meta.url, which points at bundled output under .next/ and can yield
 * a wrong or non-writable directory on Windows / Turbopack.
 */
function findProjectRootFromCwd(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    const hasPackageJson = existsSync(join(currentDir, "package.json"));
    const hasSrcDir = existsSync(join(currentDir, "src"));

    if (hasPackageJson && hasSrcDir) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return startDir;
    }

    currentDir = parentDir;
  }
}

const PROJECT_ROOT = findProjectRootFromCwd(process.cwd());
const CONFIG_DIR = join(PROJECT_ROOT, "data");
const CONFIG_PATH = join(CONFIG_DIR, "ai-config.json");

export const PROVIDER_ENV_MAP: Record<ProviderKey, string> = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

export const MODEL_PROVIDER_MAP: Record<string, ProviderKey> = {
  "gemini-2.0-flash": "google",
  "gemini-2.5-flash": "google",
  "gemini-2.5-pro": "google",
  "gemini-3-flash-preview": "google",
  "claude-sonnet-4-6": "anthropic",
  "gpt-4o": "openai",
  "deepseek-v4-flash": "deepseek",
  "deepseek-v4-pro": "deepseek",
  "deepseek-chat": "deepseek",
  "deepseek-reasoner": "deepseek",
};

const DEFAULT_CONFIG: AIConfig = {
  providers: {
    google: { apiKey: "" },
    anthropic: { apiKey: "" },
    openai: { apiKey: "" },
    deepseek: { apiKey: "" },
  },
  models: {
    "gemini-2.0-flash": true,
    "gemini-2.5-flash": true,
    "gemini-2.5-pro": true,
    "gemini-3-flash-preview": true,
    "claude-sonnet-4-6": true,
    "gpt-4o": true,
    "deepseek-v4-flash": true,
    "deepseek-v4-pro": true,
    "deepseek-chat": true,
    "deepseek-reasoner": true,
  },
};

export function readAIConfig(): AIConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Partial<AIConfig> | null;
      const safeParsed =
        parsed && typeof parsed === "object"
          ? parsed
          : ({} as Partial<AIConfig>);

      return {
        providers: { ...DEFAULT_CONFIG.providers, ...safeParsed.providers },
        models: { ...DEFAULT_CONFIG.models, ...safeParsed.models },
      };
    }
  } catch (err) {
    console.error("[AIConfig] Error reading config:", err);
  }

  return structuredClone(DEFAULT_CONFIG);
}

export function writeAIConfig(config: AIConfig): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[AIConfig] Error writing config:", err);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `No se pudo guardar la configuración (${detail}). Ruta: ${CONFIG_PATH}`,
    );
  }
}

export function getApiKey(provider: ProviderKey): string {
  const config = readAIConfig();
  const fromConfig = config.providers[provider]?.apiKey;

  if (fromConfig) {
    // Masked UI values were mistakenly persisted as the key (starts with U+2022 •).
    if (/[\u2022]/.test(fromConfig)) {
      return process.env[PROVIDER_ENV_MAP[provider]] || "";
    }
    return fromConfig;
  }

  return process.env[PROVIDER_ENV_MAP[provider]] || "";
}

export function hasApiKey(provider: ProviderKey): boolean {
  return getApiKey(provider).length > 0;
}

export function getEnabledModelIds(): string[] {
  const config = readAIConfig();

  return Object.entries(config.models)
    .filter(([modelId, enabled]) => {
      if (!enabled) return false;

      const provider = MODEL_PROVIDER_MAP[modelId];
      return provider ? hasApiKey(provider) : false;
    })
    .map(([id]) => id);
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••" + key.slice(-2);

  return "••••••••" + key.slice(-4);
}

export interface MaskedAIConfig {
  providers: Record<ProviderKey, { maskedKey: string; hasKey: boolean }>;
  models: Record<string, boolean>;
}

export function getMaskedConfig(): MaskedAIConfig {
  const config = readAIConfig();
  const providers = {} as MaskedAIConfig["providers"];

  for (const key of Object.keys(PROVIDER_ENV_MAP) as ProviderKey[]) {
    const effectiveKey = getApiKey(key);
    providers[key] = {
      maskedKey: maskApiKey(effectiveKey),
      hasKey: effectiveKey.length > 0,
    };
  }

  return { providers, models: config.models };
}
