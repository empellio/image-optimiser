import { describe, it, expect } from "vitest";
import { createImageOptimizer } from "../src/optimizer";

const redPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAHUlEQVQoU2NkYGD4z0AEYBxVSFUB/0lQGkYDAE8qBq8IQx2YAAAAAElFTkSuQmCC",
  "base64"
);

describe("image optimizer", () => {
  const optimizer = createImageOptimizer({ defaultQuality: 80, formats: ["webp", "avif", "jpeg", "png"] });

  it("resizes image to width", async () => {
    const result = await optimizer.process({ buffer: redPng, w: 5, format: "png" });
    expect(result.width).toBe(5);
    expect(result.contentType).toContain("image/");
    expect(result.buffer.length).toBeGreaterThan(10);
  });

  it("converts to webp", async () => {
    const result = await optimizer.process({ buffer: redPng, format: "webp" });
    expect(result.contentType).toBe("image/webp");
    expect(result.buffer.length).toBeGreaterThan(10);
  });
});


