import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { builtFiles, builtRoutes } from "./built-site.mjs";
import { escapeHtml } from "./html.mjs";

test("escapeHtml escapes every HTML-significant character and stringifies values", () => {
  expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
    "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
  );
  expect(escapeHtml(42)).toBe("42");
  expect(escapeHtml("plain")).toBe("plain");
});

test("built routes and files skip development output and assets", () => {
  const root = mkdtempSync(join(tmpdir(), "built-site-"));
  try {
    for (const path of [
      "index.html",
      "about/index.html",
      "blog/post/index.html",
      "assets/embeds/index.html",
      "assets/styles.css",
      "dev-3000/index.html",
      "feed.xml",
    ]) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), "");
    }
    expect(builtRoutes(root).sort()).toEqual(["/", "/about/", "/blog/post/"]);
    expect(
      builtFiles(root)
        .map((file) => relative(root, file))
        .sort(),
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
