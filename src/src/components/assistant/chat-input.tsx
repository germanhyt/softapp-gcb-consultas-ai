"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [improveEnabled, setImproveEnabled] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [improveResult, setImproveResult] = useState<{
    original: string;
    improved: string;
    explanation: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load improve preference from localStorage
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
      // Call improve-prompt API
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
          // On error, send original
          onSend(trimmed);
          setInput("");
        }
      } catch {
        // On error, send original
        onSend(trimmed);
        setInput("");
      } finally {
        setIsImproving(false);
      }
    } else {
      onSend(trimmed);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleAcceptImproved = (query: string) => {
    onSend(query);
    setInput("");
    setImproveResult(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleCancelImprove = () => {
    setImproveResult(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        "p-3 sm:p-4 border-t bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 transition-colors",
        isFocused && "bg-slate-50 dark:bg-zinc-800"
      )}
    >
      {isLoading && (
        <div className="flex items-center gap-2 mb-2 text-xs text-emerald-600 dark:text-emerald-400">
          <Sparkles className="h-3 w-3 animate-pulse" />
          <span>Procesando tu consulta...</span>
        </div>
      )}

      {/* Improve prompt loading */}
      {isImproving && <ImprovePromptLoading />}

      {/* Improve prompt preview */}
      {improveResult && (
        <ImprovePromptPreview
          original={improveResult.original}
          improved={improveResult.improved}
          explanation={improveResult.explanation}
          onAccept={handleAcceptImproved}
          onCancel={handleCancelImprove}
        />
      )}

      <div
        className={cn(
          "flex items-end gap-2 sm:gap-3 rounded-xl border-2 bg-white dark:bg-zinc-700 p-2 transition-all",
          isFocused
            ? "border-emerald-500 dark:border-emerald-500 shadow-md shadow-emerald-100 dark:shadow-none"
            : "border-slate-300 dark:border-zinc-600",
          isLoading && "opacity-80"
        )}
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
          className="min-h-[44px] max-h-[150px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          rows={1}
        />
        <Button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading || disabled || isImproving}
          size="icon"
          className={cn(
            "shrink-0 h-10 w-10 rounded-lg transition-all",
            input.trim() && !isLoading
              ? "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md"
              : ""
          )}
        >
          {isLoading || isImproving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">
            Enter
          </kbd>{" "}
          enviar ·{" "}
          <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">
            Shift+Enter
          </kbd>{" "}
          nueva línea
        </span>

        <button
          onClick={toggleImprove}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium",
            improveEnabled
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "border-slate-300 dark:border-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:border-emerald-400 text-slate-500 dark:text-slate-400"
          )}
          title={improveEnabled ? "Mejorar prompt activado - clic para desactivar" : "Activar mejorar prompt"}
        >
          <Wand2 className="h-3.5 w-3.5" />
          {improveEnabled ? "Mejorar ON" : "Mejorar"}
        </button>
      </div>
    </div>
  );
}
