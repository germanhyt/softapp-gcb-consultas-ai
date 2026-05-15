import { streamText } from "ai";
import { getModel } from "@/lib/ai/providers";
import { buildContext } from "@/lib/ai/context-builder";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { messages, modelId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ensure lastUserMessage is always a string
    const rawContent = messages[messages.length - 1]?.content;
    const lastUserMessage = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent ?? "");

    // Detect module & fetch relevant data
    let data = "";
    let systemPrompt = "";
    try {
      const ctx = await buildContext(lastUserMessage);
      data = ctx.data;
      systemPrompt = ctx.systemPrompt;
    } catch (ctxErr) {
      console.error("[AI Chat] buildContext error:", ctxErr);
      // Fall back to general prompt without data
      const { getSystemPrompt } = await import("@/lib/ai/system-prompts");
      systemPrompt = getSystemPrompt("general");
    }

    // Build full system prompt with data context (cap at 80k chars to avoid overflows)
    const now = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
    const MAX_DATA_CHARS = 40_000;
    const truncatedData = data && data.length > MAX_DATA_CHARS
      ? data.slice(0, MAX_DATA_CHARS) + "\n\n[...datos truncados por tamaño máximo...]"
      : data;

    const fullSystem = [
      systemPrompt,
      `\n[CONTEXTO ACTUAL]\nFecha y hora en Lima: ${now}\nResponde SIEMPRE en base a esta fecha cuando el usuario pregunte por "hoy", "la fecha actual", "el día actual", etc.`,
      truncatedData
        ? `\n[DATOS DEL SISTEMA]\n${truncatedData}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Stream response with selected model
    const selectedModel = modelId || process.env.DEFAULT_MODEL_ID || "gemini-2.5-flash";

    // Limit history to last 20 messages and strip stale [DATOS DEL SISTEMA] echoes from prior AI responses
    const MAX_HISTORY = 20;

    console.log(`[AI Chat] model=${selectedModel} systemLen=${fullSystem.length} msgCount=${messages.length} sent=${Math.min(messages.length, MAX_HISTORY)}`);
    const recentMessages = messages.slice(-MAX_HISTORY);
    const sanitizedMessages = recentMessages
      .filter((m: { role: string; content: unknown }) => m.content != null)
      .map((m: { role: string; content: unknown }) => {
        const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return {
          role: m.role as "user" | "assistant",
          content: m.role === "assistant"
            ? text.replace(/\[DATOS DEL SISTEMA[^\]]*\]\s*/g, "")
            : text,
        };
      });

    const result = streamText({
      model: getModel(selectedModel),
      system: fullSystem,
      messages: sanitizedMessages,
      maxTokens: 32768,
      temperature: 0.3,
      onFinish: ({ finishReason, usage }) => {
        console.log(`[AI Chat] FINISH reason=${finishReason} promptTokens=${usage?.promptTokens} completionTokens=${usage?.completionTokens}`);
      },
    });

    // X-Accel-Buffering: no prevents nginx from buffering the SSE stream
    const streamResponse = result.toDataStreamResponse();
    const headers = new Headers(streamResponse.headers);
    headers.set("X-Accel-Buffering", "no");
    headers.set("Cache-Control", "no-cache");
    return new Response(streamResponse.body, {
      status: streamResponse.status,
      headers,
    });
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
