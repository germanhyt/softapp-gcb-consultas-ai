import {
  streamText,
  convertToModelMessages,
  generateId,
  type UIMessage,
} from "ai";
import { getModel } from "@/lib/ai/providers";
import { buildContext } from "@/lib/ai/context-builder";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { textFromUIMessageParts } from "@/lib/ai/ui-message-text";

export const maxDuration = 120;

const MAX_HISTORY = 20;

/** Strip echoed context markers from prior assistant UI messages before sending to the model. */
function sanitizeUIMessagesForModel(messages: UIMessage[]): UIMessage[] {
  const recent = messages.slice(-MAX_HISTORY);
  return recent.map((m) => {
    if (m.role !== "assistant") return m;
    const newParts = m.parts.map((p) => {
      if (p.type === "text") {
        return {
          ...p,
          text: p.text.replace(/\[DATOS DEL SISTEMA[^\]]*\]\s*/g, ""),
        };
      }
      return p;
    });
    return { ...m, parts: newParts };
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages as UIMessage[] | undefined;
    const modelId = body.modelId as string | undefined;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lastUserUIMessage = [...messages].reverse().find((m) => m.role === "user");
    const lastUserMessage = lastUserUIMessage
      ? textFromUIMessageParts(lastUserUIMessage.parts)
      : "";

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
    const selectedModel = modelId || process.env.DEFAULT_MODEL_ID || DEFAULT_MODEL_ID;

    const forModel = sanitizeUIMessagesForModel(messages);
    let modelMessages;
    try {
      modelMessages = await convertToModelMessages(forModel);
    } catch (convErr) {
      console.error("[AI Chat] convertToModelMessages:", convErr);
      return new Response(
        JSON.stringify({ error: "Formato de mensajes inválido" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[AI Chat] model=${selectedModel} systemLen=${fullSystem.length} msgCount=${messages.length} sent=${forModel.length}`,
    );

    const result = streamText({
      model: getModel(selectedModel),
      system: fullSystem,
      messages: modelMessages,
      maxOutputTokens: 32768,
      temperature: 0.3,
      onFinish: ({ finishReason, totalUsage }) => {
        console.log(
          `[AI Chat] FINISH reason=${finishReason} inputTokens=${totalUsage?.inputTokens} outputTokens=${totalUsage?.outputTokens}`,
        );
      },
    });

    const streamResponse = result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      onError: () => "Error al generar la respuesta",
    });
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
