import { NextResponse } from "next/server";
import {
  readAIConfig,
  writeAIConfig,
  getMaskedConfig,
  maskApiKey,
  type ProviderKey,
  PROVIDER_ENV_MAP,
} from "@/lib/ai/ai-config";

/**
 * GET /api/settings/ai
 * Returns config with masked API keys + model enabled states.
 */
export async function GET() {
  try {
    const masked = getMaskedConfig();
    return NextResponse.json(masked);
  } catch (error) {
    console.error("[Settings AI] GET error:", error);
    return NextResponse.json(
      { error: "Error al leer configuración" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/ai
 * Body: { providers: { google: { apiKey: "..." }, ... }, models: { "gemini-2.0-flash": true, ... } }
 * If apiKey is empty, only dots/bullets, or equals the current masked key (••••••••xxxx), keeps the stored key.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const currentConfig = readAIConfig();

    if (body.providers && typeof body.providers === "object") {
      for (const [key, value] of Object.entries(body.providers)) {
        const providerKey = key as ProviderKey;
        if (!(providerKey in PROVIDER_ENV_MAP)) continue;

        const incoming = ((value as { apiKey?: string })?.apiKey ?? "").trim();
        const stored = currentConfig.providers[providerKey]?.apiKey || "";
        const maskedStored = maskApiKey(stored);
        /** Placeholder: only bullets/asterisks, or exact masked value shown in UI (••••••••abcd). */
        const unchangedPlaceholder =
          incoming === "" ||
          /^[\u2022*]+$/u.test(incoming) ||
          (maskedStored !== "" && incoming === maskedStored);

        if (unchangedPlaceholder) {
          currentConfig.providers[providerKey] = { apiKey: stored };
        } else {
          currentConfig.providers[providerKey] = { apiKey: incoming };
        }
      }
    }

    if (body.models && typeof body.models === "object") {
      for (const [modelId, enabled] of Object.entries(body.models)) {
        if (modelId in currentConfig.models) {
          currentConfig.models[modelId] = Boolean(enabled);
        }
      }
    }

    writeAIConfig(currentConfig);

    const masked = getMaskedConfig();
    return NextResponse.json(masked);
  } catch (error) {
    console.error("[Settings AI] POST error:", error);
    const message = error instanceof Error ? error.message : "Error al guardar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
