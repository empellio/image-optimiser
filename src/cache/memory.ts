import { LRUCache } from "lru-cache";
import type { CacheConfig, CacheLayer } from ".";

export function createMemoryCache(cfg: CacheConfig): CacheLayer {
  const ttlMs = (cfg.ttl ?? 60 * 60) * 1000;
  const cache = new LRUCache<string, any>({ max: 500, ttl: ttlMs });
  return {
    async get(key: string) {
      return cache.get(key) ?? null;
    },
    async set(key: string, value: any) {
      cache.set(key, value);
    },
  };
}


