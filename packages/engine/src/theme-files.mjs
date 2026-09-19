import { fileURLToPath } from "node:url";

export function themeFile(path) {
  return fileURLToPath(new URL(path, import.meta.resolve("@pulkit/theme/package.json")));
}
