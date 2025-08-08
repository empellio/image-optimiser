import type { ImageOptimizer } from "../optimizer";

export function expressAdapter(optimizer: ImageOptimizer) {
  return optimizer.express();
}


