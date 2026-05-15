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

export function SaveFavoriteDialog({ query, onSaved, onCancel }: SaveFavoriteDialogProps) {
  const autoName = query.slice(0, 40) + (query.length > 40 ? "..." : "");
  const [name, setName] = useState(autoName);
  const favorites  = loadFavorites();
  const isFull     = favorites.length >= 20;
  const isDuplicate = favorites.some((f) => f.query === query);

  const handleSave = () => {
    if (isFull || isDuplicate) return;
    const result = saveFavorite(query, name);
    if (result) onSaved();
  };

  return (
    <div
      className="mx-3 my-2 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        background: "rgba(255,200,0,0.06)",
        border: "1px solid rgba(255,200,0,0.25)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
        <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
          Guardar como favorito
        </span>
      </div>

      {isFull ? (
        <div className="flex items-start gap-2 text-xs mb-2" style={{ color: "var(--secondary)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Has alcanzado el límite de 20 favoritos. Elimina alguno primero.</span>
        </div>
      ) : isDuplicate ? (
        <div className="flex items-start gap-2 text-xs mb-2" style={{ color: "var(--secondary)" }}>
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
            className="w-full text-xs rounded-lg px-2.5 py-1.5 mb-2 outline-none transition-all duration-150"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-strong)",
              color: "var(--foreground)",
            }}
            autoFocus
            onFocus={e => (e.target.style.borderColor = "var(--primary)")}
            onBlur={e => (e.target.style.borderColor = "var(--border-strong)")}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onCancel();
            }}
          />
          <p className="text-[10px] mb-2 truncate" style={{ color: "var(--foreground-subtle)" }}>
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
          style={{ color: "var(--foreground-muted)" }}
        >
          Cancelar
        </Button>
        {!isFull && !isDuplicate && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim()}
            className="h-7 text-xs"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              border: "none",
            }}
          >
            Guardar
          </Button>
        )}
      </div>
    </div>
  );
}
