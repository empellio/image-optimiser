import sharp, { FormatEnum, Sharp } from "sharp";
import { z } from "zod";
import { fetchImage } from "./fetch";
import { CacheLayer, createCache } from "./cache";
import type { IncomingHttpHeaders } from "http";

export type SupportedFormat = keyof FormatEnum | "webp" | "avif" | "jpeg" | "png";

export type OptimizerConfig = {
  cache?: { type: "memory" | "disk" | "redis"; path?: string; ttl?: number };
  formats?: SupportedFormat[];
  maxWidth?: number;
  maxHeight?: number;
  defaultQuality?: number;
  whitelist?: string[];
};

export type ProcessInput = {
  url?: string;
  buffer?: Buffer;
  headers?: IncomingHttpHeaders;
  w?: number;
  h?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside" | "crop";
  format?: SupportedFormat;
  quality?: number;
  crop?: "smart" | "center";
  bg?: string;
  blur?: number;
  grayscale?: boolean;
  rotate?: number;
  placeholder?: "blur" | "none";
};

export type ProcessResult = {
  buffer: Buffer;
  contentType: string;
  etag: string;
  width?: number;
  height?: number;
};

const querySchema = z.object({
  url: z.string().url().optional(),
  w: z.coerce.number().int().positive().max(10000).optional(),
  h: z.coerce.number().int().positive().max(10000).optional(),
  fit: z.enum(["cover", "contain", "fill", "inside", "outside", "crop"]).default("cover"),
  format: z.enum(["webp", "avif", "jpeg", "png"]).optional(),
  quality: z.coerce.number().int().min(1).max(100).optional(),
  crop: z.enum(["smart", "center"]).default("center").optional(),
  bg: z.string().optional(),
  blur: z.coerce.number().min(0).max(100).optional(),
  grayscale: z.coerce.boolean().optional(),
  rotate: z.coerce.number().optional(),
  placeholder: z.enum(["blur", "none"]).optional(),
});

function createEtag(bytes: Buffer): string {
  const base = bytes.byteLength.toString(16);
  const sum = [...bytes.slice(0, 64)].reduce((a, b) => (a + b) % 65536, 0);
  return `W/\"${base}-${sum}\"`;
}

function buildSharpPipeline(input: Sharp, params: Required<Pick<ProcessInput, "fit">> & ProcessInput): Sharp {
  const { w, h, fit, crop, bg, blur, grayscale, rotate } = params;
  if (w || h) {
    input = input.resize({ width: w, height: h, fit: fit === "crop" ? "cover" : fit, position: crop === "center" ? "centre" : "attention" });
  }
  if (bg) input = input.flatten({ background: bg });
  if (blur) input = input.blur(blur);
  if (grayscale) input = input.grayscale();
  if (rotate) input = input.rotate(rotate);
  return input;
}

function formatToContentType(format?: SupportedFormat): string {
  switch (format) {
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

export function createImageOptimizer(config: OptimizerConfig = {}) {
  const cache: CacheLayer | null = config.cache ? createCache(config.cache) : null;
  const allowedFormats = new Set((config.formats ?? ["webp", "avif", "jpeg", "png"]) as SupportedFormat[]);
  const defaultQuality = config.defaultQuality ?? 80;

  async function process(input: ProcessInput): Promise<ProcessResult> {
    const parsed = querySchema.partial({ url: true }).parse(input);

    if (!input.buffer && !parsed.url) {
      throw Object.assign(new Error("No input provided"), { statusCode: 400 });
    }

    if (config.whitelist && parsed.url) {
      const allowed = config.whitelist.some((d) => {
        try {
          const u = new URL(parsed.url!);
          return u.hostname.endsWith(d);
        } catch {
          return false;
        }
      });
      if (!allowed) {
        throw Object.assign(new Error("Source URL not allowed"), { statusCode: 403 });
      }
    }

    // Enforce maximum dimensions if configured
    if (config.maxWidth && input.w && input.w > config.maxWidth) input.w = config.maxWidth;
    if (config.maxHeight && input.h && input.h > config.maxHeight) input.h = config.maxHeight;

    const cacheKey = JSON.stringify({
      u: parsed.url ? new URL(parsed.url).toString() : "buffer",
      w: parsed.w,
      h: parsed.h,
      fit: parsed.fit,
      f: parsed.format,
      q: parsed.quality ?? defaultQuality,
      c: parsed.crop,
      bg: parsed.bg,
      bl: parsed.blur,
      gs: parsed.grayscale,
      r: parsed.rotate,
      p: parsed.placeholder,
    });

    if (cache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    let sourceBuffer: Buffer;
    if (input.buffer) {
      sourceBuffer = input.buffer;
    } else {
      const fetched = await fetchImage(parsed.url!);
      sourceBuffer = fetched.buffer;
    }

    let sh = sharp(sourceBuffer, { failOnError: false });

    const format = parsed.format && allowedFormats.has(parsed.format) ? parsed.format : undefined;
    const pipelineParams = { ...parsed, fit: (parsed.fit ?? "cover") as any } as Required<Pick<ProcessInput, "fit">> & ProcessInput;
    sh = buildSharpPipeline(sh, pipelineParams);

    const q = parsed.quality ?? defaultQuality;
    if (parsed.placeholder === "blur") {
      sh = sh.resize({ width: 10 }).blur(10);
    }

    if (format === "webp") sh = sh.webp({ quality: q });
    else if (format === "avif") sh = sh.avif({ quality: q });
    else if (format === "jpeg") sh = sh.jpeg({ quality: q });
    else if (format === "png") sh = sh.png({ quality: q });

    const output = await sh.toBuffer({ resolveWithObject: true });
    const etag = createEtag(output.data);

    const result: ProcessResult = {
      buffer: output.data,
      contentType: format ? formatToContentType(format) : output.info.format ? formatToContentType(output.info.format as SupportedFormat) : "application/octet-stream",
      etag,
      width: output.info.width,
      height: output.info.height,
    };

    if (cache) await cache.set(cacheKey, result);
    return result;
  }

  function buildCacheHeaders(result: ProcessResult, ttlSeconds: number | undefined) {
    const headers: Record<string, string> = {
      "Content-Type": result.contentType,
      ETag: result.etag,
      "Cache-Control": ttlSeconds ? `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}` : "public, max-age=0",
    };
    return headers;
  }

  return {
    process,
    express() {
      const expressMiddleware = async (req: any, res: any) => {
        try {
          if (req.method === "HEAD") {
            // Validate
            const parsed = querySchema.parse(req.query);
            const result = await process({ ...parsed, url: parsed.url });
            const headers = buildCacheHeaders(result, config.cache?.ttl);
            Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
            res.status(200).end();
            return;
          }

          const parsed = querySchema.parse(req.query);
          const result = await process({ ...parsed, url: parsed.url });
          const ifNoneMatch = req.headers?.["if-none-match"];
          if (ifNoneMatch && ifNoneMatch === result.etag) {
            res.status(304).end();
            return;
          }
          const headers = buildCacheHeaders(result, config.cache?.ttl);
          Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
          res.status(200).end(result.buffer);
        } catch (err: any) {
          const status = err?.statusCode ?? 500;
          res.status(status).json({ error: err?.message ?? "Internal Error" });
        }
      };
      return expressMiddleware;
    },
    fastify() {
      return (instance: any, _opts: any, done: any) => {
        instance.get("/", async (request: any, reply: any) => {
          try {
            if (request.method === "HEAD") {
              const parsed = querySchema.parse(request.query);
              const result = await process({ ...parsed, url: parsed.url });
              const headers = buildCacheHeaders(result, config.cache?.ttl);
              reply.headers(headers).status(200).send();
              return;
            }
            const parsed = querySchema.parse(request.query);
            const result = await process({ ...parsed, url: parsed.url });
            const ifNoneMatch = (request.headers as any)?.["if-none-match"]; // fastify keeps headers lower-cased
            if (ifNoneMatch && ifNoneMatch === result.etag) {
              reply.code(304).send();
              return;
            }
            const headers = buildCacheHeaders(result, config.cache?.ttl);
            reply.headers(headers).status(200).send(result.buffer);
          } catch (err: any) {
            const status = err?.statusCode ?? 500;
            reply.code(status).send({ error: err?.message ?? "Internal Error" });
          }
        });
        done();
      };
    },
  };
}

export type ImageOptimizer = ReturnType<typeof createImageOptimizer>;


