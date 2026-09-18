import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { logDuration } from "./duration.mjs";

const startedAt = performance.now();
for (const directory of ["dist", ".cache", "node_modules/.vite", "node_modules/.vite-temp"]) {
  rmSync(fileURLToPath(new URL(`../${directory}`, import.meta.url)), {
    recursive: true,
    force: true,
  });
}
logDuration("Removed dist and all project caches", startedAt);
