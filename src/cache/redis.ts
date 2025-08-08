import type { CacheConfig, CacheLayer } from ".";

type MinimalRedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
};

export function createRedisCache(cfg: CacheConfig & { client?: MinimalRedisClient }): CacheLayer {
  const client = (cfg as any).client as MinimalRedisClient | undefined;
  if (!client) {
    throw new Error("Redis cache requires a provided ioredis client via config.client");
  }
  const ttlSeconds = cfg.ttl ?? 60 * 60;
  return {
    async get(key: string) {
      const raw = await client.get(key);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (value?.buffer && typeof value.buffer === "string") {
        value.buffer = Buffer.from(value.buffer, "base64");
      }
      return value;
    },
    async set(key: string, value: any) {
      const serializable = {
        ...value,
        buffer: Buffer.isBuffer(value.buffer) ? value.buffer.toString("base64") : value.buffer,
      };
      await client.set(key, JSON.stringify(serializable), "EX", ttlSeconds);
    },
  };
}


