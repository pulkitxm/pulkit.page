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

const packages = join(repository, "packages");

export function generationVersion() {
  const files = [
    ...readdirSync(packages, { recursive: true })
      .filter(
        (path) =>
          !path.includes("node_modules") &&
          (/\/src\/.+(?<!\.test)\.(?:mjs|ts)$/.test(path) ||
            /^demos\/showcases\/.+\.json$/.test(path)),
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

export function generationCache(outputDirectory, version, enabled = true) {
  const path = join(".cache", "generate", `${digest(resolve(outputDirectory))}.json`);
  let previous = {};
  if (enabled) {
    try {
      const stored = readJson(path);
      if (stored.version === version) {
        previous = stored.entries;
      }
    } catch {
      previous = {};
    }
  }
  const entries = Object.fromEntries(Object.entries(previous ?? {}).slice(-4096));
  const pending = new Map();
  const counts = {};
  return {
    counts,
    get(kind, input, create, onAccess) {
      const key = `${kind}:${digest(JSON.stringify(input))}`;
      const cached = entries[key] ?? previous?.[key];
      if (cached && typeof cached.value === "string" && digest(cached.value) === cached.hash) {
        entries[key] = cached;
        onAccess?.("hit");
        return cached.value;
      }
      if (pending.has(key)) {
        onAccess?.("pending");
        return pending.get(key);
      }
      onAccess?.("miss");
      counts[kind] = (counts[kind] ?? 0) + 1;
      const record = (created) => {
        entries[key] = { value: created, hash: digest(created) };
        return created;
      };
      const value = create();
      if (value instanceof Promise) {
        const result = value.then(record).finally(() => pending.delete(key));
        pending.set(key, result);
        return result;
      }
      return record(value);
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
