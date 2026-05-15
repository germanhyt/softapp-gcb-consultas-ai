"use client";

import { useState } from "react";
import {
  loadFavorites,
  removeFavorite,
  updateFavoriteUseCount,
  renameFavorite,
  type Favorite,
} from "@/lib/favorites";
import { Button } from "@/components/ui/button";
import { Star, Trash2, Play, Pencil, Check, Search, X } from "lucide-react";

interface FavoritesPanelProps {
  onExecute: (query: string) => void;
  onClose: () => void;
}

export function FavoritesPanel({ onExecute, onClose }: FavoritesPanelProps) {
  const [favorites,  setFavorites]  = useState<Favorite[]>(loadFavorites);
  const [search,     setSearch]     = useState("");
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState("");

  const filtered = search
    ? favorites.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.query.toLowerCase().includes(search.toLowerCase())
      )
    : favorites;

  const sorted = [...filtered].sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleExecute = (fav: Favorite) => {
    updateFavoriteUseCount(fav.id);
    setFavorites(loadFavorites());
    onExecute(fav.query);
    onClose();
  };

  const handleRemove = (id: string) => {
    removeFavorite(id);
    setFavorites(loadFavorites());
  };

  const handleStartEdit = (fav: Favorite) => {
    setEditingId(fav.id);
    setEditName(fav.name);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      renameFavorite(id, editName);
      setFavorites(loadFavorites());
    }
    setEditingId(null);
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--surface-3)",
    border: "1px solid var(--border-strong)",
    color: "var(--foreground)",
    borderRadius: "0.5rem",
    padding: "0.3rem 0.5rem",
    fontSize: "0.75rem",
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
  };

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col animate-in fade-in duration-200"
      style={{ background: "var(--surface)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Favoritos
          </h3>
          <span className="text-[10px]" style={{ color: "var(--foreground-subtle)" }}>
            ({favorites.length}/20)
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
          style={{ color: "var(--foreground-muted)" }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      {favorites.length > 5 && (
        <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: "var(--foreground-subtle)" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar favoritos..."
              style={{ ...inputStyle, paddingLeft: "2rem" }}
              onFocus={e => (e.target.style.borderColor = "var(--primary)")}
              onBlur={e => (e.target.style.borderColor = "var(--border-strong)")}
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full px-6 text-center"
            style={{ color: "var(--foreground-muted)" }}
          >
            <Star className="h-8 w-8 mb-3 opacity-20" />
            <p className="text-sm font-medium">Sin favoritos</p>
            <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
              Haz clic en la estrella junto a un mensaje para guardar la consulta como favorito.
            </p>
          </div>
        ) : (
          <div style={{ borderBottom: "1px solid var(--border)" }}>
            {sorted.map((fav) => (
              <div
                key={fav.id}
                className="px-4 py-2.5 group transition-colors duration-100"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {editingId === fav.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(fav.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = "var(--primary)")}
                      onBlur={e => (e.target.style.borderColor = "var(--border-strong)")}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSaveEdit(fav.id)}
                      className="h-6 w-6 shrink-0"
                    >
                      <Check className="h-3 w-3" style={{ color: "var(--primary)" }} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => handleExecute(fav)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                          {fav.name}
                        </p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
                          {fav.query}
                        </p>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleExecute(fav)}
                          className="h-6 w-6" title="Ejecutar"
                        >
                          <Play className="h-3 w-3" style={{ color: "var(--primary)" }} />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleStartEdit(fav)}
                          className="h-6 w-6" title="Renombrar"
                        >
                          <Pencil className="h-3 w-3" style={{ color: "var(--foreground-muted)" }} />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleRemove(fav.id)}
                          className="h-6 w-6" title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" style={{ color: "var(--tertiary)" }} />
                        </Button>
                      </div>
                    </div>

                    {fav.useCount > 0 && (
                      <p className="text-[9px] mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
                        Usado {fav.useCount} {fav.useCount === 1 ? "vez" : "veces"}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
