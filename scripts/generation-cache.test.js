import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { generationCache } from "./generation-cache.mjs";
import { renderDependencies } from "./render-page.mjs";

const original = process.cwd();
const temporary = [];
afterEach(() => {
  process.chdir(original);
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("cache validates stored values, versions, isolation and disabled reads", async () => {
  const directory = mkdtempSync(join(tmpdir(), "generation-cache-"));
  temporary.push(directory);
  process.chdir(directory);
  let calls = 0;
  const create = () => String(++calls);
  const first = generationCache("pages", "v1");
  expect(await first.get("fence", ["js", "a"], async () => create())).toBe("1");
  first.save();
  expect(generationCache("pages", "v1").get("fence", ["js", "a"], create)).toBe("1");
  expect(generationCache("dist", "v1").get("fence", ["js", "a"], create)).toBe("2");
  expect(generationCache("pages", "v2").get("fence", ["js", "a"], create)).toBe("3");
  expect(generationCache("pages", "v1", false).get("fence", ["js", "a"], create)).toBe("4");
  const path = join(".cache/generate", readdirSync(".cache/generate")[0]);
  const state = JSON.parse(readFileSync(path, "utf8"));
  Object.values(state.entries)[0].value = "corrupt";
  writeFileSync(path, JSON.stringify(state));
  expect(generationCache("pages", "v1").get("fence", ["js", "a"], create)).toBe("5");
  writeFileSync(path, "invalid JSON");
  expect(generationCache("pages", "v1").get("fence", ["js", "a"], create)).toBe("6");
});

test("page dependencies follow listing limits, schema, breadcrumbs and related links", () => {
  const page = { route: "/", body: ":::list blogs limit=1", metadata: { title: "Home" } };
  const posts = [
    { route: "/blogs/new/", metadata: { title: "New", date: "2026-01-01", tags: ["web"] } },
    { route: "/blogs/old/", metadata: { title: "Old", date: "2025-01-01", tags: ["web"] } },
  ];
  const pages = [page, ...posts];
  const site = { url: "https://example.com", brand: "Example" };
  const before = renderDependencies(page, pages, site);
  posts[1].body = "Changed body";
  posts[1].metadata.title = "Changed older title";
  expect(renderDependencies(page, pages, site)).toEqual(before);
  posts[0].metadata.title = "Changed latest title";
  expect(renderDependencies(page, pages, site)).not.toEqual(before);
  const article = { ...posts[0], body: "" };
  const related = renderDependencies(article, pages, site);
  posts[1].metadata.title = "Changed related title";
  expect(renderDependencies(article, pages, site)).not.toEqual(related);
});
