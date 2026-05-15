"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Check, X, Loader2 } from "lucide-react";

interface ImprovePromptPreviewProps {
  original: string;
  improved: string;
  explanation: string;
  onAccept: (query: string) => void;
  onCancel: () => void;
}

export function ImprovePromptPreview({
  original,
  improved,
  explanation,
  onAccept,
  onCancel,
}: ImprovePromptPreviewProps) {
  const [editedQuery, setEditedQuery] = useState(improved);

  return (
    <div className="mx-3 my-2 p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          Consulta mejorada
        </span>
      </div>

      {explanation && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 italic">
          {explanation}
        </p>
      )}

      <Textarea
        value={editedQuery}
        onChange={(e) => setEditedQuery(e.target.value)}
        className="min-h-[60px] max-h-[120px] resize-none text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-200 focus-visible:ring-emerald-500 mb-2"
        rows={2}
      />

      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setEditedQuery(original);
          }}
          className="text-[10px] text-muted-foreground hover:text-foreground underline"
        >
          Restaurar original
        </button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => onAccept(editedQuery)}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="h-3 w-3 mr-1" />
            Usar mejorada
          </Button>
        </div>
      </div>
    </div>
  );
}

// Loading state component
export function ImprovePromptLoading() {
  return (
    <div className="mx-3 my-2 p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-md animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
        <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
          Mejorando tu consulta...
        </span>
      </div>
    </div>
  );
}
