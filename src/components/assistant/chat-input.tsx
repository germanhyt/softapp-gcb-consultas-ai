"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  ImprovePromptPreview,
  ImprovePromptLoading,
} from "./improve-prompt-preview";

const IMPROVE_KEY = "refugio_improve_prompt";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  isLoading = false,
  disabled = false,
  placeholder = "Escribe tu pregunta...",
}: ChatInputProps) {
  const [input,          setInput]          = useState("");
  const [isFocused,      setIsFocused]      = useState(false);
  const [improveEnabled, setImproveEnabled] = useState(false);
  const [isImproving,    setIsImproving]    = useState(false);
  const [improveResult,  setImproveResult]  = useState<{
    original: string;
    improved: string;
    explanation: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setImproveEnabled(localStorage.getItem(IMPROVE_KEY) === "true");
    }
  }, []);

  const toggleImprove = useCallback(() => {
    setImproveEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(IMPROVE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled || isImproving) return;

    if (improveEnabled) {
      setIsImproving(true);
      try {
        const res = await fetch("/api/ai/improve-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });
        if (res.ok) {
          const data = await res.json();
          setImproveResult({
            original: trimmed,
            improved: data.improved || trimmed,
            explanation: data.explanation || "",
          });
        } else {
          onSend(trimmed);
          setInput("");
        }
      } catch {
        onSend(trimmed);
        setInput("");
      } finally {
        setIsImproving(false);
      }
    } else {
      onSend(trimmed);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  };

  const handleAcceptImproved = (query: string) => {
    onSend(query);
    setInput("");
    setImproveResult(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="p-3 sm:p-4"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* Processing indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: "var(--primary)" }}>
          <Sparkles className="h-3 w-3 animate-pulse" />
          <span>Procesando tu consulta...</span>
        </div>
      )}

      {isImproving && <ImprovePromptLoading />}

      {improveResult && (
        <ImprovePromptPreview
          original={improveResult.original}
          improved={improveResult.improved}
          explanation={improveResult.explanation}
          onAccept={handleAcceptImproved}
          onCancel={() => setImproveResult(null)}
        />
      )}

      {/* Input box */}
      <div
        className="flex items-end gap-2 sm:gap-3 rounded-xl p-2 transition-all duration-150"
        style={{
          background: "var(--surface-2)",
          border: isFocused
            ? "2px solid var(--primary)"
            : "2px solid var(--border-strong)",
          boxShadow: isFocused ? "0 0 0 3px rgba(56,209,73,0.10)" : "none",
          opacity: isLoading ? 0.8 : 1,
        }}
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isLoading || disabled || isImproving}
          className="min-h-[44px] max-h-[150px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm"
          style={{ color: "var(--foreground)" }}
          rows={1}
        />
        <Button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading || disabled || isImproving}
          size="icon"
          className="shrink-0 h-10 w-10 rounded-lg transition-all duration-150"
          style={
            input.trim() && !isLoading
              ? {
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  boxShadow: "0 0 12px rgba(56,209,73,0.35)",
                }
              : {
                  background: "var(--surface-3)",
                  color: "var(--foreground-subtle)",
                }
          }
        >
          {isLoading || isImproving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          <kbd
            className="px-1 py-0.5 rounded text-[10px] font-mono"
            style={{ background: "var(--surface-3)", color: "var(--foreground-muted)" }}
          >
            Enter
          </kbd>{" "}
          enviar ·{" "}
          <kbd
            className="px-1 py-0.5 rounded text-[10px] font-mono"
            style={{ background: "var(--surface-3)", color: "var(--foreground-muted)" }}
          >
            Shift+Enter
          </kbd>{" "}
          nueva línea
        </span>

        <button
          onClick={toggleImprove}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150"
          style={
            improveEnabled
              ? {
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  borderColor: "var(--primary)",
                  boxShadow: "0 0 10px rgba(56,209,73,0.30)",
                }
              : {
                  background: "transparent",
                  color: "var(--foreground-subtle)",
                  borderColor: "var(--border-strong)",
                }
          }
          title={improveEnabled ? "Mejorar prompt activado — clic para desactivar" : "Activar mejorar prompt"}
        >
          <Wand2 className="h-3.5 w-3.5" />
          {improveEnabled ? "Mejorar ON" : "Mejorar"}
        </button>
      </div>
    </div>
  );
}
