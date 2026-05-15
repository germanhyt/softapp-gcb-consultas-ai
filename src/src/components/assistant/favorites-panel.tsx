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
import { cn } from "@/lib/utils";

interface FavoritesPanelProps {
  onExecute: (query: string) => void;
  onClose: () => void;
}

export function FavoritesPanel({ onExecute, onClose }: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<Favorite[]>(loadFavorites);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const filtered = search
    ? favorites.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.query.toLowerCase().includes(search.toLowerCase())
      )
    : favorites;

  // Sort by useCount desc, then by createdAt desc
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

  return (
    <div className="absolute inset-0 z-20 bg-white dark:bg-zinc-950 flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          <h3 className="text-sm font-semibold">Favoritos</h3>
          <span className="text-[10px] text-muted-foreground">
            ({favorites.length}/20)
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search (show if >5 favorites) */}
      {favorites.length > 5 && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-zinc-700">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar favoritos..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center text-muted-foreground">
            <Star className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm font-medium">Sin favoritos</p>
            <p className="text-xs mt-1">
              Haz clic en la estrella junto a un mensaje para guardar la
              consulta como favorito.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {sorted.map((fav) => (
              <div
                key={fav.id}
                className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors group"
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
                      className="flex-1 text-xs border border-slate-200 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSaveEdit(fav.id)}
                      className="h-6 w-6"
                    >
                      <Check className="h-3 w-3 text-emerald-600" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => handleExecute(fav)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-xs font-medium truncate">
                          {fav.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {fav.query}
                        </p>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleExecute(fav)}
                          className="h-6 w-6"
                          title="Ejecutar"
                        >
                          <Play className="h-3 w-3 text-emerald-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(fav)}
                          className="h-6 w-6"
                          title="Renombrar"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(fav.id)}
                          className="h-6 w-6"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {fav.useCount > 0 && (
                      <p className="text-[9px] text-muted-foreground mt-0.5">
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
