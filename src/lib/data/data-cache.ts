interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class DataCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL: number;

  constructor(ttlSeconds = 300) {
    this.defaultTTL = ttlSeconds * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance for server-side use
export const dataCache = new DataCache(300);
