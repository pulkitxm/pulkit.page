import { afterEach, expect, test } from "bun:test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { removeTemporaryDirectories, temporaryDirectory } from "../../test/lib/harness.ts";
import { generationCache } from "./generation-cache.ts";
import { isRecord } from "./guards.ts";

const original = process.cwd();
afterEach(() => {
  process.chdir(original);
  removeTemporaryDirectories();
});

function corruptFirstEntry(path: string): void {
  const state: unknown = JSON.parse(readFileSync(path, "utf8"));
  const entry = isRecord(state) && isRecord(state.entries) ? Object.values(state.entries)[0] : null;
  if (!isRecord(entry)) {
    throw new Error("Expected a stored cache entry");
  }
  entry.value = "corrupt";
  writeFileSync(path, JSON.stringify(state));
}

test("cache validates stored values, versions, isolation and disabled reads", async () => {
  process.chdir(temporaryDirectory("generation-cache-"));
  let calls = 0;
  const create = () => String(++calls);
  const first = generationCache("pages", "v1");
  expect(await first.getAsync("fence", ["js", "a"], async () => create())).toBe("1");
  first.save();
  expect(generationCache("pages", "v1").get("fence", ["js", "a"], create)).toBe("1");
  expect(generationCache("dist", "v1").get("fence", ["js", "a"], create)).toBe("2");
  expect(generationCache("pages", "v2").get("fence", ["js", "a"], create)).toBe("3");
  expect(generationCache("pages", "v1", false).get("fence", ["js", "a"], create)).toBe("4");
  const path = join(".cache/generate", readdirSync(".cache/generate")[0] ?? "");
  corruptFirstEntry(path);
  expect(generationCache("pages", "v1").get("fence", ["js", "a"], create)).toBe("5");
  writeFileSync(path, "invalid JSON");
  expect(generationCache("pages", "v1").get("fence", ["js", "a"], create)).toBe("6");
});

test("concurrent asynchronous reads share one pending computation", async () => {
  process.chdir(temporaryDirectory("generation-cache-"));
  const cache = generationCache("pages", "v1");
  const states: string[] = [];
  let calls = 0;
  const create = async () => String(++calls);
  const results = await Promise.all([
    cache.getAsync("html", "/", create, (state) => states.push(state)),
    cache.getAsync("html", "/", create, (state) => states.push(state)),
  ]);
  expect(results).toEqual(["1", "1"]);
  expect(states).toEqual(["miss", "pending"]);
  expect(cache.counts).toEqual({ html: 1 });
});
