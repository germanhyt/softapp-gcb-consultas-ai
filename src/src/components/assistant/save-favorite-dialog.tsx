"use client";

import { useState } from "react";
import { saveFavorite, loadFavorites } from "@/lib/favorites";
import { Button } from "@/components/ui/button";
import { Star, AlertTriangle } from "lucide-react";

interface SaveFavoriteDialogProps {
  query: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function SaveFavoriteDialog({
  query,
  onSaved,
  onCancel,
}: SaveFavoriteDialogProps) {
  const autoName = query.slice(0, 40) + (query.length > 40 ? "..." : "");
  const [name, setName] = useState(autoName);
  const favorites = loadFavorites();
  const isFull = favorites.length >= 20;
  const isDuplicate = favorites.some((f) => f.query === query);

  const handleSave = () => {
    if (isFull || isDuplicate) return;
    const result = saveFavorite(query, name);
    if (result) onSaved();
  };

  return (
    <div className="mx-3 my-2 p-3 rounded-lg border-2 border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-4 w-4 text-yellow-500" />
        <span className="text-xs font-semibold">Guardar como favorito</span>
      </div>

      {isFull ? (
        <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 mb-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Has alcanzado el límite de 20 favoritos. Elimina alguno primero.</span>
        </div>
      ) : isDuplicate ? (
        <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 mb-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Esta consulta ya está guardada como favorito.</span>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del favorito"
            className="w-full text-xs border border-slate-300 dark:border-zinc-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onCancel();
            }}
          />
          <p className="text-[10px] text-muted-foreground mb-2 truncate">
            {query}
          </p>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Cancelar
        </Button>
        {!isFull && !isDuplicate && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim()}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
          >
            Guardar
          </Button>
        )}
      </div>
    </div>
  );
}
