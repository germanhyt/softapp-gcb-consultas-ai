export interface Favorite {
  id: string;
  name: string;
  query: string;
  createdAt: string;
  useCount: number;
}

const STORAGE_KEY = "refugio_favorites";
const MAX_FAVORITES = 20;

export function loadFavorites(): Favorite[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function persistFavorites(favorites: Favorite[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

export function saveFavorite(query: string, name?: string): Favorite | null {
  const favorites = loadFavorites();
  if (favorites.length >= MAX_FAVORITES) return null;

  // Check for duplicate query
  if (favorites.some((f) => f.query === query)) return null;

  const autoName = name?.trim() || query.slice(0, 40) + (query.length > 40 ? "..." : "");

  const favorite: Favorite = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: autoName,
    query,
    createdAt: new Date().toISOString(),
    useCount: 0,
  };

  favorites.push(favorite);
  persistFavorites(favorites);
  return favorite;
}

export function removeFavorite(id: string): void {
  const favorites = loadFavorites().filter((f) => f.id !== id);
  persistFavorites(favorites);
}

export function updateFavoriteUseCount(id: string): void {
  const favorites = loadFavorites();
  const idx = favorites.findIndex((f) => f.id === id);
  if (idx !== -1) {
    favorites[idx].useCount++;
    persistFavorites(favorites);
  }
}

export function renameFavorite(id: string, newName: string): void {
  const favorites = loadFavorites();
  const idx = favorites.findIndex((f) => f.id === id);
  if (idx !== -1) {
    favorites[idx].name = newName.trim();
    persistFavorites(favorites);
  }
}

export function isFavoriteQuery(query: string): boolean {
  return loadFavorites().some((f) => f.query === query);
}
