import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { CacheConfig, CacheLayer } from ".";

type CacheRecord = { value: any; expiresAt: number | null };

export function createDiskCache(cfg: CacheConfig): CacheLayer {
  const dir = cfg.path ?? ".cache/images";
  const ttlMs = cfg.ttl ? cfg.ttl * 1000 : null;

  async function ensureDir() {
    await fs.mkdir(dir, { recursive: true });
  }

  function fileForKey(key: string) {
    const hash = crypto.createHash("sha1").update(key).digest("hex");
    return path.join(dir, `${hash}.json`);
  }

  return {
    async get(key: string) {
      await ensureDir();
      const file = fileForKey(key);
      try {
        const raw = await fs.readFile(file, "utf8");
        const rec = JSON.parse(raw) as CacheRecord;
        if (rec.expiresAt && Date.now() > rec.expiresAt) {
          await fs.rm(file).catch(() => {});
          return null;
        }
        // Recreate Buffers inside value (buffer stored as base64)
        if (rec.value?.buffer && typeof rec.value.buffer === "string") {
          rec.value.buffer = Buffer.from(rec.value.buffer, "base64");
        }
        return rec.value;
      } catch {
        return null;
      }
    },
    async set(key: string, value: any) {
      await ensureDir();
      const file = fileForKey(key);
      const expiresAt = ttlMs ? Date.now() + ttlMs : null;
      const serializable = {
        ...value,
        buffer: Buffer.isBuffer(value.buffer) ? value.buffer.toString("base64") : value.buffer,
      };
      const rec: CacheRecord = { value: serializable, expiresAt };
      await fs.writeFile(file, JSON.stringify(rec));
    },
  };
}


