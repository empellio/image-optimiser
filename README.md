## @empellio/image-optimizer

Server-side image optimization library (inspired by the Next.js Image API).

### Installation

```bash
npm i @empellio/image-optimizer sharp got
```

### Quick start

```ts
import express from "express";
import { createImageOptimizer } from "@empellio/image-optimizer";

const app = express();

const optimizer = createImageOptimizer({
  cache: { type: "disk", path: "./.cache/images", ttl: 60 * 60 * 24 },
  formats: ["webp", "avif", "jpeg", "png"],
  maxWidth: 4000,
  maxHeight: 4000,
  defaultQuality: 80,
});

app.use("/image", optimizer.express());

app.listen(3000);
```

### Fastify

```ts
import Fastify from "fastify";
import { createImageOptimizer } from "@empellio/image-optimizer";

const fastify = Fastify();
const optimizer = createImageOptimizer();

fastify.register(optimizer.fastify(), { prefix: "/image" });

fastify.listen({ port: 3000 });
```

### Request

```
GET /image?url=https://example.com/photo.jpg&w=800&h=600&fit=crop&format=webp&quality=80
```

### Parameters

- `url`: source image (URL, local path, or uploaded buffer)
- `w`: target width (optional)
- `h`: target height (optional)
- `fit`: `cover` | `contain` | `fill` | `inside` | `outside` | `crop` (default: `cover`)
- `format`: `webp` | `avif` | `jpeg` | `png` (default: keep original)
- `quality`: 1–100 (default: 80)
- `crop`: `smart` (attention-based) or `center` (default)
- `bg`: background color (used when flattening transparent images)
- `blur`: blur radius (e.g., for placeholders)
- `grayscale`: convert to grayscale
- `rotate`: rotation in degrees (e.g., 90, 180)
- `placeholder`: `blur` to generate a 10px blurred placeholder

### Programmatic usage

```ts
import { createImageOptimizer } from "@empellio/image-optimizer";

const optimizer = createImageOptimizer();
const result = await optimizer.process({ buffer, format: "webp", w: 300 });
```

### Tests & build

```bash
npm run test
npm run build
```

### Demo servers

- Express demo: `npm run demo:express` → http://localhost:3001
- Fastify demo: `npm run demo:fastify` → http://localhost:3002

```bash
# run demo servers
npm run demo:express
npm run demo:fastify
```


