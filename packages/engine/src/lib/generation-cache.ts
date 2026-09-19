import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { readJson } from "@pulkit/shared/files";
import { sha256Hex as digest } from "@pulkit/shared/hash";
import { repositoryRoot as repository } from "@pulkit/shared/repository";
import { isRecord } from "./guards.ts";

const packages = join(repository, "packages");
const hashedSource = /\/src\/.+(?<!\.test)\.ts$/;

export type CacheAccess = "hit" | "pending" | "miss";
type AccessListener = (state: CacheAccess) => void;

interface CacheEntry {
  value: string;
  hash: string;
}

export interface GenerationCache {
  readonly counts: Record<string, number>;
  get(kind: string, input: unknown, create: () => string, onAccess?: AccessListener): string;
  getAsync(
    kind: string,
    input: unknown,
    create: () => Promise<string>,
    onAccess?: AccessListener,
  ): Promise<string>;
  save(): void;
}

export function generationVersion(): string {
  const files = [
    ...readdirSync(packages, { recursive: true, encoding: "utf8" })
      .filter(
        (path) =>
          !path.includes("node_modules") &&
          (hashedSource.test(path) || /^demos\/showcases\/.+\.json$/.test(path)),
      )
      .map((path) => join(packages, path)),
    join(repository, "biome.json"),
    join(repository, "bun.lock"),
    join(packages, "theme/assets/fonts/ibm-plex-mono-regular.ttf"),
  ];
  return digest(
    files
      .sort()
      .filter(existsSync)
      .map((path) => `${relative(repository, path)}:${digest(readFileSync(path))}`)
      .join("\n"),
  );
}

function isCacheEntry(value: unknown): value is CacheEntry {
  return isRecord(value) && typeof value.value === "string" && typeof value.hash === "string";
}

function storedEntries(path: string, version: string): Record<string, unknown> {
  try {
    const stored = readJson(path);
    return isRecord(stored) && stored.version === version && isRecord(stored.entries)
      ? stored.entries
      : {};
  } catch {
    return {};
  }
}

export function generationCache(
  outputDirectory: string,
  version: string,
  enabled = true,
): GenerationCache {
  const path = join(".cache", "generate", `${digest(resolve(outputDirectory))}.json`);
  const previous = enabled ? storedEntries(path, version) : {};
  const entries: Record<string, unknown> = Object.fromEntries(
    Object.entries(previous).slice(-4096),
  );
  const pending = new Map<string, Promise<string>>();
  const counts: Record<string, number> = {};
  function keyOf(kind: string, input: unknown): string {
    return `${kind}:${digest(JSON.stringify(input))}`;
  }
  function lookup(key: string, onAccess: AccessListener | undefined): string | undefined {
    const stored = entries[key] ?? previous[key];
    const cached = isCacheEntry(stored) && digest(stored.value) === stored.hash ? stored : null;
    if (cached) {
      entries[key] = cached;
      onAccess?.("hit");
    }
    return cached?.value;
  }
  function miss(kind: string, onAccess: AccessListener | undefined): void {
    onAccess?.("miss");
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  function record(key: string, value: string): string {
    entries[key] = { value, hash: digest(value) };
    return value;
  }
  return {
    counts,
    get(kind, input, create, onAccess) {
      const key = keyOf(kind, input);
      const cached = lookup(key, onAccess);
      if (cached !== undefined) {
        return cached;
      }
      miss(kind, onAccess);
      return record(key, create());
    },
    getAsync(kind, input, create, onAccess) {
      const key = keyOf(kind, input);
      const cached = lookup(key, onAccess);
      if (cached !== undefined) {
        return Promise.resolve(cached);
      }
      const waiting = pending.get(key);
      if (waiting) {
        onAccess?.("pending");
        return waiting;
      }
      miss(kind, onAccess);
      const result = create()
        .then((value) => record(key, value))
        .finally(() => pending.delete(key));
      pending.set(key, result);
      return result;
    },
    save() {
      if (enabled) {
        mkdirSync(dirname(path), { recursive: true });
        const temporary = `${path}.${process.pid}.tmp`;
        writeFileSync(temporary, JSON.stringify({ version, entries }));
        renameSync(temporary, path);
      }
    },
  };
}
