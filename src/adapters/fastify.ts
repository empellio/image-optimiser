import type { ImageOptimizer } from "../optimizer";

export function fastifyAdapter(optimizer: ImageOptimizer) {
  return function (instance: any, opts: any, done: any) {
    return (optimizer as any).fastify()(instance, opts, done);
  };
}


