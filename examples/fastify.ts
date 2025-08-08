import Fastify from 'fastify';
import { createImageOptimizer } from '../src/optimizer';

const fastify = Fastify();

const optimizer = createImageOptimizer({
  cache: { type: 'memory', ttl: 60 * 10 },
  formats: ['webp', 'avif', 'jpeg', 'png'],
  defaultQuality: 80,
});

fastify.get('/', async () => {
  return {
    message:
      'Fastify demo running. Example: /image?url=https://picsum.photos/seed/empellio/1200/800&w=800&h=600&fit=crop&format=avif&quality=70',
  };
});

fastify.register(optimizer.fastify(), { prefix: '/image' });

const port = Number(process.env.PORT || 3002);
fastify.listen({ port }, (err, address) => {
  if (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`Fastify demo at ${address}`);
});


