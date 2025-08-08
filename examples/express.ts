import express from 'express';
import { createImageOptimizer } from '../src/optimizer';

const app = express();

const optimizer = createImageOptimizer({
  cache: { type: 'disk', path: './.cache/images', ttl: 60 * 60 * 24 },
  formats: ['webp', 'avif', 'jpeg', 'png'],
  maxWidth: 4000,
  maxHeight: 4000,
  defaultQuality: 80,
});

app.get('/', (_req, res) => {
  res.type('text/plain').send(
    'Express demo running. Example: /image?url=https://picsum.photos/seed/empellio/1200/800&w=800&h=600&fit=crop&format=webp&quality=80',
  );
});

app.use('/image', optimizer.express());

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Express demo at http://localhost:${port}`);
});


