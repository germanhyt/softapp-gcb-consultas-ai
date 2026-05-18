import type { UIMessage } from "ai";

/** Concatena solo las partes de tipo texto de un UIMessage (cliente o servidor). */
export function textFromUIMessageParts(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
