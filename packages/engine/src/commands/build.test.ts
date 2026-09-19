import { afterEach, expect, test } from "bun:test";
import type { SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  build,
  buildEnvironment,
  buildProject,
  pageSource as source,
} from "../../test/lib/build-fixture.ts";
import { removeTemporaryDirectories, writeFiles } from "../../test/lib/harness.ts";

afterEach(removeTemporaryDirectories);

function computed(result: SpawnSyncReturns<string>): unknown {
  expect(result.status).toBe(0);
  return JSON.parse(/Computed (.+)/.exec(result.stdout)?.[1] ?? "null");
}

function htmlRenders(result: SpawnSyncReturns<string>): unknown {
  const counts = computed(result);
  return typeof counts === "object" && counts !== null && "html" in counts ? counts.html : 0;
}

test("build renders nested routes, crawler files, cards, assets and fingerprinted styles", () => {
  const cwd = buildProject({
    "content/notes/example.md": source
      .replace("layout: home", "layout: simple")
      .replace("Building things", "Example"),
    "dist/dev-3456/index.html": "running preview",
    "dist/stale.html": "stale",
  });
  const result = build(cwd);
  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/Rendered 2 pages \([\d.]+ (?:ms|s)\)/);
  expect(result.stdout).toMatch(/Built dist for https:\/\/example.com \([\d.]+ (?:ms|s)\)/);
  expect(readFileSync(join(cwd, "dist/notes/example/index.html"), "utf8")).toContain("data-title");
  expect(readFileSync(join(cwd, "dist/sitemap.xml"), "utf8")).toContain(
    "<loc>https://example.com/notes/example/</loc>",
  );
  expect(readFileSync(join(cwd, "dist/robots.txt"), "utf8")).toContain(
    "https://example.com/sitemap.xml",
  );
  expect(readFileSync(join(cwd, "dist/og/home/card.png")).subarray(1, 4).toString()).toBe("PNG");
  expect(readFileSync(join(cwd, "dist/assets/example.txt"), "utf8")).toBe("asset");
  expect(readFileSync(join(cwd, "dist/CNAME"), "utf8")).toBe("example.com\n");
  expect(readFileSync(join(cwd, "dist/dev-3456/index.html"), "utf8")).toBe("running preview");
  expect(existsSync(join(cwd, "dist/stale.html"))).toBe(false);
  const built = readFileSync(join(cwd, "dist/index.html"), "utf8");
  const styles = /href="\/(styles\.[0-9a-f]{12}\.css)"/.exec(built)?.[1] ?? "";
  expect(existsSync(join(cwd, "dist", styles))).toBe(true);
  expect(existsSync(join(cwd, "dist/styles.css"))).toBe(false);
  expect(existsSync(join(cwd, "dist/theme.js"))).toBe(false);
  expect(built).toContain("portfolio-theme");
  rmSync(join(cwd, "content/notes/example.md"));
  expect(build(cwd).status).toBe(0);
  expect(existsSync(join(cwd, "dist/notes/example/index.html"))).toBe(false);
  expect(readFileSync(join(cwd, "dist/sitemap.xml"), "utf8")).not.toContain("/notes/");
}, 30_000);

test("preview builds use their own origin and never claim the production domain", () => {
  const cwd = buildProject();
  const result = build(
    cwd,
    buildEnvironment({ NODE_ENV: "staging", SITE_URL: "https://preview.example" }),
  );
  expect(result.status).toBe(0);
  const html = readFileSync(join(cwd, "dist/index.html"), "utf8");
  expect(html).toContain('href="https://preview.example/"');
  expect(html).toContain('content="https://preview.example/og/home/card.png"');
  expect(html).not.toContain("https://example.com");
  expect(readFileSync(join(cwd, "dist/sitemap.xml"), "utf8")).toContain(
    "<loc>https://preview.example/</loc>",
  );
  expect(existsSync(join(cwd, "dist/CNAME"))).toBe(false);
}, 30_000);

test("conflicting routes and unsupported MDX fail the build", () => {
  const cwd = buildProject({ "content/index.md": source });
  expect(build(cwd).stderr).toContain("Multiple Markdown sources map to /");
  rmSync(join(cwd, "content/index.md"));
  writeFileSync(join(cwd, "content/article.mdx"), source);
  expect(build(cwd).stderr).toContain("MDX is not supported");
}, 30_000);

test("rebuilds reuse cached renders and invalidate on content and layout edits", () => {
  const post = (title: string, date: string) =>
    `---\ntitle: ${title}\ndescription: Example article.\ndate: ${date}\ntags: [web]\n---\n\nExample body.\n\n\`\`\`js\nconst x=1;\n\`\`\`\n`;
  const cwd = buildProject({
    "content/_site.md": "---\nbrand: Pulkit\narticles: /blogs/\n---\n",
    "content/home.md": `${source}\n:::list blogs limit=1\n`,
    "content/blogs/index.md": `${source.replace("Building things", "Writing")}\n:::list blogs\n`,
    "content/blogs/first.md": post("First", "2026-01-01"),
    "content/blogs/second.md": post("Second", "2025-01-01"),
  });
  const first = join(cwd, "content/blogs/first.md");
  expect(htmlRenders(build(cwd))).toBe(4);
  expect(computed(build(cwd))).toEqual({});
  writeFileSync(first, readFileSync(first, "utf8").replace("Example body", "Edited body"));
  expect(computed(build(cwd))).toEqual({ html: 1 });
  writeFileSync(first, readFileSync(first, "utf8").replace("title: First", "title: Updated first"));
  expect(computed(build(cwd))).toMatchObject({ html: 4, card: 1 });
  const footer = join(cwd, "layouts/partials/footer.html");
  writeFiles(cwd, {
    "layouts/partials/footer.html": readFileSync(footer, "utf8").replace(
      "<footer",
      '<footer aria-label="Footer"',
    ),
  });
  expect(htmlRenders(build(cwd))).toBe(4);
}, 60_000);
