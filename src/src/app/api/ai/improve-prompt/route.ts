import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export const maxDuration = 30;

const META_PROMPT = `Eres un experto en mejorar consultas para un asistente de inteligencia de negocios de un restaurante llamado "El Refugio".

El asistente tiene acceso a datos de:
- Conciliación de tarjetas (vouchers, procesadores de pago, Niubiz, Amex, Diners)
- Ventas del POS Toteat
- Estacionamiento
- Flujo de personas

Tu tarea es mejorar la consulta del usuario para que sea más específica, clara y obtenga mejores resultados.

Reglas:
- Mantén el idioma español
- Si la consulta es vaga, hazla más específica (agrega rangos de fechas, métricas concretas)
- Si pide datos, sugiere incluir comparaciones o tendencias
- No cambies la intención del usuario
- La consulta mejorada debe ser natural, como si la escribiera una persona
- Máximo 2-3 oraciones

Responde SOLAMENTE con un JSON con esta estructura (sin markdown, sin backticks):
{"improved": "la consulta mejorada", "explanation": "breve explicación de qué se mejoró"}`;

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "No query provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Always use Gemini Flash for speed
    const result = await generateText({
      model: google("gemini-2.5-flash"),
      system: META_PROMPT,
      prompt: query,
      maxTokens: 500,
      temperature: 0.4,
    });

    // Parse the JSON response
    const text = result.text.trim();
    // Handle potential markdown wrapping
    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");

    try {
      const parsed = JSON.parse(cleaned);
      return new Response(JSON.stringify(parsed), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // If JSON parsing fails, return the raw text as improved
      return new Response(
        JSON.stringify({
          improved: text,
          explanation: "Consulta mejorada automáticamente",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[Improve Prompt] Error:", error);
    const message =
      error instanceof Error ? error.message : "Error al mejorar consulta";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
