import { rmSync } from "node:fs";
import { logDuration } from "@pulkit/shared/duration";

const startedAt = performance.now();
for (const directory of [
  "dist",
  ".cache",
  ".turbo",
  "node_modules/.vite",
  "node_modules/.vite-temp",
]) {
  rmSync(directory, { recursive: true, force: true });
}
logDuration("Removed dist and all project caches", startedAt);
