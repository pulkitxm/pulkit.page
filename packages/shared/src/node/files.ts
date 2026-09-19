import type { Dirent } from "node:fs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type SkipEntry = (entry: Dirent, directory: string) => boolean;

export function walkFiles(root: string, skip: SkipEntry = () => false): string[] {
  function walk(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (skip(entry, directory)) {
        return [];
      }
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  }
  return walk(root);
}

export function readJson(path: string | URL): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
