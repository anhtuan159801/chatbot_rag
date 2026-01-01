interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private maxSize: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  getCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}:${params[k]}`)
      .join("|");
    return `${prefix}:${sortedParams}`;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Cleanup if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    };

    this.cache.set(key, entry);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const embeddingCache = new CacheService(500, 3600000); // 1 hour
export const ragCache = new CacheService(200, 300000); // 5 mins
