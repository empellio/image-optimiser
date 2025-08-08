import got from "got";

export async function fetchImage(url: string): Promise<{ buffer: Buffer; contentType?: string }> {
  const res = await got(url, { responseType: "buffer", retry: { limit: 2 } });
  const buffer = Buffer.from(res.body as Buffer);
  const contentType = res.headers["content-type"]; 
  return { buffer, contentType: Array.isArray(contentType) ? contentType[0] : contentType };
}


