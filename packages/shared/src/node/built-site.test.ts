import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { builtFiles, builtRoutes, developmentOutputName } from "./built-site.ts";

test("built routes and files skip development output and assets", () => {
  const root = mkdtempSync(join(tmpdir(), "built-site-"));
  try {
    for (const path of [
      "index.html",
      "about/index.html",
      "blog/post/index.html",
      "assets/embeds/index.html",
      "assets/styles.css",
      `${developmentOutputName("3000")}/index.html`,
      "feed.xml",
    ]) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), "");
    }
    expect(builtRoutes(root).toSorted((a, b) => a.localeCompare(b))).toEqual([
      "/",
      "/about/",
      "/blog/post/",
    ]);
    expect(
      builtFiles(root)
        .map((file) => relative(root, file))
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual([
      "about/index.html",
      "assets/embeds/index.html",
      "assets/styles.css",
      "blog/post/index.html",
      "feed.xml",
      "index.html",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
