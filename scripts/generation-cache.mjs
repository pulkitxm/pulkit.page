import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function generationVersion() {
  const files = [
    ...(existsSync("scripts") ? readdirSync("scripts", { recursive: true }) : [])
      .filter((path) => path.endsWith(".mjs"))
      .map((path) => join("scripts", path)),
    "biome.json",
    "bun.lock",
    "assets/fonts/ibm-plex-mono-regular.ttf",
  ];
  return digest(
    files
      .sort()
      .filter(existsSync)
      .map((path) => `${path}:${digest(readFileSync(path))}`)
      .join("\n"),
  );
}

export function generationCache(outputDirectory, version, enabled = true) {
  const path = join(".cache", "generate", `${digest(resolve(outputDirectory))}.json`);
  let previous = {};
  if (enabled) {
    try {
      const stored = JSON.parse(readFileSync(path, "utf8"));
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
      const record = (value) => {
        entries[key] = { value, hash: digest(value) };
        return value;
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
