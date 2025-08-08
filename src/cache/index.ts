import { createMemoryCache } from "./memory";
import { createDiskCache } from "./disk";
import { createRedisCache } from "./redis";

export type CacheLayer = {
  get: (key: string) => Promise<any | null>;
  set: (key: string, value: any) => Promise<void>;
};

export type CacheConfig = { type: "memory" | "disk" | "redis"; path?: string; ttl?: number };

export function createCache(cfg: CacheConfig): CacheLayer {
  if (cfg.type === "memory") return createMemoryCache(cfg);
  if (cfg.type === "disk") return createDiskCache(cfg);
  if (cfg.type === "redis") return createRedisCache(cfg);
  throw new Error("Unknown cache type");
}

export { createMemoryCache } from "./memory";
export { createDiskCache } from "./disk";
export { createRedisCache } from "./redis";


