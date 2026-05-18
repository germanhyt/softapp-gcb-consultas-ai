import { generateText } from "ai";
import { getModel } from "@/lib/ai/providers";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { buildContext } from "@/lib/ai/context-builder";

interface ReportResult {
  content: string;
  module: string;
  model: string;
  generatedAt: string;
}

export async function generateReport(
  query: string,
  modelId: string = DEFAULT_MODEL_ID
): Promise<ReportResult> {
  const { data, systemPrompt, module } = await buildContext(query);

  const now = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
  const fullSystem = [
    systemPrompt,
    data ? `\n[DATOS DEL SISTEMA - ${now}]\n${data}` : "",
    "\nIMPORTANTE: Este es un reporte automático que será enviado por email. Incluye tablas y datos detallados.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateText({
    model: getModel(modelId),
    system: fullSystem,
    prompt: query,
    maxOutputTokens: 4096,
    temperature: 0.3,
  });

  return {
    content: result.text,
    module,
    model: modelId,
    generatedAt: new Date().toISOString(),
  };
}
