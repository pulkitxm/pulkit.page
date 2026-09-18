import { afterEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { checkLayouts } from "./check-layouts.mjs";
import { loadLayouts } from "./layouts.mjs";
import { renderPage } from "./render-page.mjs";

const root = resolve(import.meta.dir, "..");
const source =
  "---\ntitle: Building things\ndescription: Example page.\nlayout: home\n---\n\nSoftware engineer based in India.\n";
const temporary = [];
const fixtureEnv = { ...process.env, NODE_ENV: "production", SITE_URL: "", SITE_OUTPUT_DIR: "" };

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), "homepage-test-"));
  temporary.push(directory);
  cpSync(join(root, "biome.json"), join(directory, "biome.json"));
  cpSync(join(root, "layouts"), join(directory, "layouts"), { recursive: true });
  mkdirSync(join(directory, "content"));
  mkdirSync(join(directory, "pages"));
  writeFileSync(join(directory, "CNAME"), "example.com\n");
  cpSync(join(root, "assets/fonts"), join(directory, "assets/fonts"), { recursive: true });
  writeFileSync(join(directory, "content/_site.md"), "---\nbrand: Pulkit\n---\n");
  return directory;
}

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("pre-commit checks the staged snapshot, not unstaged repairs", async () => {
  const cwd = workspace();
  const git = (...args) => execFileSync("git", args, { env: fixtureEnv, cwd, stdio: "pipe" });
  git("init", "--quiet");
  cpSync(join(root, "scripts"), join(cwd, "scripts"), { recursive: true });
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({ type: "module", scripts: { ci: "bun scripts/generate.mjs --check" } }),
  );
  writeFileSync(join(cwd, "content/home.md"), source);
  execFileSync("bun", [join(root, "scripts/generate.mjs")], { env: fixtureEnv, cwd });
  writeFileSync(join(cwd, "pages/index.html"), "staged stale output\n");
  git("add", ".");
  symlinkSync(join(root, "node_modules"), join(cwd, "node_modules"));
  execFileSync("bun", [join(root, "scripts/generate.mjs")], { env: fixtureEnv, cwd });
  const html = readFileSync(join(cwd, "pages/index.html"), "utf8");
  writeFileSync(join(cwd, "pages/index.html"), html);
  const before = git("diff", "--cached").toString();
  const run = () =>
    spawnSync("sh", [join(root, ".githooks/pre-commit")], {
      env: fixtureEnv,
      cwd,
      encoding: "utf8",
    });
  const failed = run();
  expect(failed.status).toBe(1);
  expect(failed.stderr).toContain("out of sync");
  expect(git("diff", "--cached").toString()).toBe(before);
  expect(readFileSync(join(cwd, "pages/index.html"), "utf8")).toBe(html);
  git("add", "pages/index.html");
  expect(run().status).toBe(0);
  writeFileSync(join(cwd, "content/home.md"), source.replace("based in India", "based elsewhere"));
  git("add", "content/home.md");
  expect(run().status).toBe(1);
});

test("sync rejects every extra HTML page, including legacy and nested pages", async () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "content/home.md"), source);
  execFileSync("bun", [join(root, "scripts/generate.mjs")], { env: fixtureEnv, cwd });
  mkdirSync(join(cwd, "pages/orphan"));
  mkdirSync(join(cwd, "pages/extras"));
  writeFileSync(join(cwd, "pages/extras/hidden.html"), "extra nested page");
  mkdirSync(join(cwd, "blogs"));
  writeFileSync(join(cwd, "pages/orphan/index.html"), "extra generated page");
  writeFileSync(join(cwd, "blogs/index.html"), "legacy page");
  writeFileSync(join(cwd, "unexpected.HTM"), "extra root page");
  const result = spawnSync("bun", [join(root, "scripts/generate.mjs"), "--check"], {
    env: fixtureEnv,
    cwd,
    encoding: "utf8",
  });
  expect(result.status).toBe(1);
  for (const file of [
    "pages/orphan/index.html",
    "pages/extras/hidden.html",
    "blogs/index.html",
    "unexpected.HTM",
  ]) {
    expect(result.stderr).toContain(file);
  }
  expect(readFileSync(join(cwd, "pages/orphan/index.html"), "utf8")).toBe("extra generated page");
});

test("recursive sources generate routes and deleting a source leaves a detected orphan", () => {
  const cwd = workspace();
  mkdirSync(join(cwd, "content/notes"));
  writeFileSync(join(cwd, "content/home.md"), source);
  writeFileSync(
    join(cwd, "content/notes/example.md"),
    source.replace("layout: home", "layout: simple"),
  );
  const run = (...args) =>
    spawnSync("bun", [join(root, "scripts/generate.mjs"), ...args], {
      env: fixtureEnv,
      cwd,
      encoding: "utf8",
    });
  expect(run().status).toBe(0);
  expect(readFileSync(join(cwd, "pages/notes/example/index.html"), "utf8")).toContain("data-title");
  expect(run("--check").status).toBe(0);
  rmSync(join(cwd, "pages/notes/example/index.html"));
  expect(run("--check").stderr).toContain("Missing HTML: pages/notes/example/index.html");
  expect(run().status).toBe(0);
  rmSync(join(cwd, "content/notes/example.md"));
  expect(run("--check").stderr).toContain(
    "Extra HTML without a Markdown source: pages/notes/example/index.html",
  );
});

test("conflicting routes and unsupported MDX fail explicitly", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "content/home.md"), source);
  writeFileSync(join(cwd, "content/index.md"), source);
  const run = () =>
    spawnSync("bun", [join(root, "scripts/generate.mjs"), "--check"], {
      env: fixtureEnv,
      cwd,
      encoding: "utf8",
    });
  expect(run().stderr).toContain("Multiple Markdown sources map to /");
  rmSync(join(cwd, "content/index.md"));
  writeFileSync(join(cwd, "content/article.mdx"), source);
  expect(run().stderr).toContain("MDX is not supported");
});

test("reference projects and build artifacts are excluded from the published page inventory", async () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "content/home.md"), source);
  execFileSync("bun", [join(root, "scripts/generate.mjs")], { env: fixtureEnv, cwd });
  for (const folder of ["extras", "dist", "node_modules"]) {
    mkdirSync(join(cwd, folder));
    writeFileSync(join(cwd, folder, "unrelated.html"), "not a page source");
  }
  const result = spawnSync("bun", [join(root, "scripts/generate.mjs"), "--check"], {
    env: fixtureEnv,
    cwd,
  });
  expect(result.status).toBe(0);
});

test("deployment build copies generated pages and assets and rejects legacy root HTML", () => {
  const cwd = workspace();
  cpSync(join(root, "scripts"), join(cwd, "scripts"), { recursive: true });
  symlinkSync(join(root, "node_modules"), join(cwd, "node_modules"));
  writeFileSync(join(cwd, "content/home.md"), source);
  mkdirSync(join(cwd, "assets"), { recursive: true });
  writeFileSync(join(cwd, "assets/example.txt"), "asset");
  cpSync(join(root, "demos"), join(cwd, "demos"), { recursive: true });
  for (const file of ["styles.css", "theme.js", ".nojekyll"]) {
    writeFileSync(join(cwd, file), "");
  }
  const run = (file) =>
    spawnSync("bun", [join(cwd, "scripts", file)], { env: fixtureEnv, cwd, encoding: "utf8" });
  const generation = run("generate.mjs");
  expect(generation.status).toBe(0);
  expect(generation.stdout).toMatch(/Rendered 1 pages \([\d.]+ (?:ms|s)\)/);
  expect(generation.stdout).toMatch(/Generation complete \([\d.]+ (?:ms|s)\)/);
  mkdirSync(join(cwd, "dist/dev-3456"), { recursive: true });
  writeFileSync(join(cwd, "dist/dev-3456/index.html"), "running preview");
  const build = run("build.mjs");
  expect(build.status).toBe(0);
  expect(build.stdout).toMatch(/Verified production pages \([\d.]+ (?:ms|s)\)/);
  expect(build.stdout).toMatch(/Built dist for https:\/\/example.com \([\d.]+ (?:ms|s)\)/);
  expect(readFileSync(join(cwd, "dist/dev-3456/index.html"), "utf8")).toBe("running preview");
  const explicit = spawnSync("bun", [join(cwd, "scripts/build.mjs")], {
    env: { ...fixtureEnv, SITE_URL: "https://example.com" },
    cwd,
    encoding: "utf8",
  });
  expect(explicit.status).toBe(0);
  expect(readFileSync(join(cwd, "dist/CNAME"), "utf8")).toBe("example.com\n");
  const preview = spawnSync("bun", [join(cwd, "scripts/build.mjs")], {
    env: { ...fixtureEnv, SITE_URL: "https://preview.example", NODE_ENV: "staging" },
    cwd,
    encoding: "utf8",
  });
  expect(preview.status).toBe(0);
  expect(readFileSync(join(cwd, "dist/index.html"), "utf8")).toContain("https://preview.example/");
  expect(existsSync(join(cwd, "dist/CNAME"))).toBe(false);
  expect(readFileSync(join(cwd, "dist/dev-3456/index.html"), "utf8")).toBe("running preview");
  expect(run("build.mjs").status).toBe(0);
  const built = readFileSync(join(cwd, "dist/index.html"), "utf8");
  const [, styles] = built.match(/href="\/(styles\.[0-9a-f]{12}\.css)"/);
  const [, theme] = built.match(/src="\/(theme\.[0-9a-f]{12}\.js)"/);
  expect(existsSync(join(cwd, "dist", styles))).toBe(true);
  expect(existsSync(join(cwd, "dist", theme))).toBe(true);
  expect(existsSync(join(cwd, "dist/styles.css"))).toBe(false);
  expect(existsSync(join(cwd, "dist/theme.js"))).toBe(false);
  expect(built.replace(`/${styles}`, "/styles.css").replace(`/${theme}`, "/theme.js")).toBe(
    readFileSync(join(cwd, "pages/index.html"), "utf8"),
  );
  expect(readFileSync(join(cwd, "dist/assets/example.txt"), "utf8")).toBe("asset");
  writeFileSync(join(cwd, "legacy.html"), "legacy");
  const failed = run("build.mjs");
  expect(failed.status).not.toBe(0);
  expect(failed.stderr).toContain("Extra HTML without a Markdown source: legacy.html");
});

test("templates are checked separately and shared partial edits invalidate output", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "content/home.md"), source);
  const run = (...args) =>
    spawnSync("bun", [join(root, "scripts/generate.mjs"), ...args], {
      env: fixtureEnv,
      cwd,
      encoding: "utf8",
    });
  expect(run().status).toBe(0);
  expect(run("--check").status).toBe(0);
  const footer = join(cwd, "layouts/partials/footer.html");
  writeFileSync(
    footer,
    readFileSync(footer, "utf8").replace("<footer", '<footer aria-label="Footer"'),
  );
  expect(run("--check").stderr).toContain("Stale HTML: pages/index.html");
  expect(run().status).toBe(0);
  expect(run("--check").status).toBe(0);
});

test("all templates reject unknown placeholders, missing includes, cycles, and invalid HTML", async () => {
  const cwd = workspace();
  const directory = join(cwd, "layouts");
  const simple = join(directory, "simple.html");
  const original = readFileSync(simple, "utf8");
  writeFileSync(simple, original.replace(/{{\s*content\s*}}/, "{{typo}}"));
  expect(() => loadLayouts(directory)).toThrow("Unknown template placeholder");
  writeFileSync(simple, original.replace(/{{\s*>\s*head\s*}}/, "{{> missing}}"));
  expect(() => loadLayouts(directory)).toThrow("Missing partial");
  writeFileSync(simple, original.replace(/{{\s*content\s*}}/, ""));
  expect(() => loadLayouts(directory)).toThrow("exactly one {{content}}");
  writeFileSync(
    simple,
    original.replace(/{{\s*content\s*}}/, '<img src="/example.png" />{{content}}'),
  );
  await expect(checkLayouts(directory)).rejects.toThrow("Invalid HTML");
  writeFileSync(simple, original);
  writeFileSync(join(directory, "partials/footer.html"), "{{> footer}}\n");
  expect(() => loadLayouts(directory)).toThrow("Circular partial");
});

test("metadata is escaped, heading IDs are unique, and code examples stay literal", async () => {
  const html = await renderPage(
    [
      "---",
      "title: '<script> & {{heading}}'",
      "---",
      "",
      "## Same",
      "",
      "## Same",
      "",
      "```html",
      "<div>example</div>",
      "```",
      "",
    ].join("\n"),
  );
  expect(html).toContain("&lt;script&gt; &amp; {{heading}}");
  expect(html).toContain('id="same"');
  expect(html).toContain('id="same-1"');
  expect(html).toContain('class="language-html ');
  expect(html).toContain("&lt;");
  expect(html).toContain("example");
  expect(html).not.toContain("<div>example</div>");
});

test("shared metadata changes invalidate output and clean only removes orphan pages", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "content/home.md"), source);
  const run = (...args) =>
    spawnSync("bun", [join(root, "scripts/generate.mjs"), ...args], {
      env: fixtureEnv,
      cwd,
      encoding: "utf8",
    });
  expect(run().status).toBe(0);
  writeFileSync(join(cwd, "content/_site.md"), "---\nbrand: New brand\n---\n");
  expect(run("--check").stderr).toContain("Stale HTML");
  mkdirSync(join(cwd, "pages/orphan"));
  writeFileSync(join(cwd, "pages/orphan/index.html"), "old");
  writeFileSync(join(cwd, "legacy.html"), "legacy");
  expect(run("--clean").status).toBe(1);
  expect(readFileSync(join(cwd, "legacy.html"), "utf8")).toBe("legacy");
  expect(run("--check").stderr).not.toContain("pages/orphan");
  rmSync(join(cwd, "legacy.html"));
  expect(run("--check").status).toBe(0);
});

test("collections list direct posts, keep nested posts in their category, and respect limits", async () => {
  const pages = [
    { route: "/blogs/older/", metadata: { title: "Older", date: "2025-01-01" } },
    { route: "/blogs/oldest/", metadata: { title: "Oldest", date: "2024-01-01" } },
    { route: "/blogs/series/new/", metadata: { title: "Newer", date: "2026-01-01" } },
    { route: "/blogs/series/", index: true, metadata: { title: "Series" } },
  ];
  const html = await renderPage(`${source}\n:::list blogs limit=1\n`, { pages });
  expect(html).toContain("Older");
  expect(html).not.toContain("Oldest");
  expect(html).not.toContain("Newer");
  const category = await renderPage(`${source}\n:::list blogs/series\n`, { pages });
  expect(category).toContain("Newer");
  expect(category).not.toContain("Older");
  expect(html).not.toContain('href="/blogs/series/"');
  await expect(renderPage(`${source}\n:::list missing\n`, { pages })).rejects.toThrow(
    "Empty or unknown collection",
  );
});

test("invalid metadata and list directives fail instead of publishing broken markup", async () => {
  for (const metadata of ["- item", "title: Test\ndate: false", "title: Test\ndate: 2026-02-30"]) {
    await expect(renderPage(`---\n${metadata}\n---\n`)).rejects.toThrow();
  }
  await expect(renderPage(`${source}\n:::list blogs limit=0\n`)).rejects.toThrow(
    "Invalid list directive",
  );
  const html = await renderPage(`${source}\n## Same\n\n## Same\n\n## Same-1\n\n## Main\n`);
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
});

test("carousel directives render sliding images and reject stray content", async () => {
  const images = ["First", "Second"].map((alt) => `![${alt}](/assets/${alt}.webp)`).join("\n\n");
  const html = await renderPage(`${source}\n:::carousel\n\n${images}\n\n:::\n`);
  expect(html.match(/data-carousel-track/g)).toHaveLength(1);
  expect(html).toContain('alt="Second"');
  expect(html).toContain("1 / 2");
  await expect(renderPage(`${source}\n:::carousel\n\n${images}\n\nText\n\n:::\n`)).rejects.toThrow(
    "Invalid carousel directive",
  );
  await expect(
    renderPage(`${source}\n:::carousel\n\n![Only](/assets/a.webp)\n\n:::\n`),
  ).rejects.toThrow("Invalid carousel directive");
});

test("sitemap and image synchronization detects missing, stale, extra and changed page inventory", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "CNAME"), "example.com\n");
  writeFileSync(join(cwd, "content/_site.md"), "---\nbrand: Example\n---\n");
  writeFileSync(join(cwd, "content/home.md"), source);
  const run = (...args) =>
    spawnSync("bun", [join(root, "scripts/generate.mjs"), ...args], {
      env: fixtureEnv,
      cwd,
      encoding: "utf8",
    });
  expect(run().status).toBe(0);
  const sitemapPath = join(cwd, "pages/sitemap.xml");
  const sitemap = readFileSync(sitemapPath, "utf8");
  expect(sitemap).toContain("<loc>https://example.com/</loc>");
  for (const corrupt of [
    "",
    sitemap.replace("https://example.com/", "https://old.example/"),
    sitemap.replace("</urlset>", "<url><loc>https://example.com/extra/</loc></url></urlset>"),
    sitemap.replace("</urlset>", "<url><loc>https://example.com/</loc></url></urlset>"),
  ]) {
    writeFileSync(sitemapPath, corrupt);
    expect(run("--check").stderr).toContain("stale generated asset: pages/sitemap.xml");
  }
  rmSync(sitemapPath);
  expect(run("--check").status).toBe(1);
  writeFileSync(sitemapPath, sitemap);
  const cardPath = join(cwd, "pages/og/home/card.png");
  const card = readFileSync(cardPath);
  writeFileSync(cardPath, "broken image");
  expect(run("--check").stderr).toContain("pages/og/home/card.png");
  writeFileSync(cardPath, card);
  writeFileSync(join(cwd, "pages/og/extra.png"), card);
  expect(run("--check").stderr).toContain("Extra generated asset");
  expect(run("--clean").status).toBe(0);
  writeFileSync(join(cwd, "content/about.md"), source.replace("Building things", "About"));
  expect(run("--check").status).toBe(1);
  expect(run().status).toBe(0);
  expect(readFileSync(sitemapPath, "utf8")).toContain("https://example.com/about/");
  rmSync(join(cwd, "content/about.md"));
  expect(run("--check").status).toBe(1);
  expect(run("--clean").status).toBe(0);
  expect(readFileSync(sitemapPath, "utf8")).not.toContain("/about/");
  expect(run("--check").status).toBe(0);
});

test("preview generation isolates output and CNAME changes invalidate production sitemap", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "content/home.md"), source);
  const run = (env = fixtureEnv, args = []) =>
    spawnSync("bun", [join(root, "scripts/generate.mjs"), ...args], { cwd, env, encoding: "utf8" });
  expect(run().status).toBe(0);
  const production = readFileSync(join(cwd, "pages/index.html"), "utf8");
  const preview = { ...fixtureEnv, NODE_ENV: "staging", SITE_URL: "https://preview.example" };
  expect(run(preview).status).toBe(0);
  const html = readFileSync(join(cwd, "dist/index.html"), "utf8");
  expect(html).toContain('href="https://preview.example/"');
  expect(html).toContain('content="https://preview.example/og/home/card.png"');
  expect(html).not.toContain("https://example.com");
  expect(readFileSync(join(cwd, "dist/sitemap.xml"), "utf8")).toContain(
    "<loc>https://preview.example/</loc>",
  );
  expect(readFileSync(join(cwd, "dist/robots.txt"), "utf8")).toContain(
    "https://preview.example/sitemap.xml",
  );
  expect(readFileSync(join(cwd, "pages/index.html"), "utf8")).toBe(production);
  expect(run(preview, ["--check"]).status).toBe(0);
  writeFileSync(join(cwd, "CNAME"), "changed.example\n");
  expect(run(fixtureEnv, ["--check"]).stderr).toContain("pages/sitemap.xml");
  expect(run().status).toBe(0);
  expect(readFileSync(join(cwd, "pages/sitemap.xml"), "utf8")).toContain(
    "https://changed.example/",
  );
});

test("HTML formatting preserves check marks in highlighted shell transcripts", async () => {
  const html = await renderPage(
    `${source}\n\n\`\`\`bash\n\u2714 Would you like TypeScript?\n\`\`\`\n`,
  );
  expect(html).toContain("&#10004;");
  expect(html).not.toContain("√");
});

test("cached generation matches full checks and preserves explicit cleanup semantics", () => {
  const cwd = workspace();
  cpSync(join(root, "scripts"), join(cwd, "scripts"), { recursive: true });
  cpSync(join(root, "bun.lock"), join(cwd, "bun.lock"));
  symlinkSync(join(root, "node_modules"), join(cwd, "node_modules"));
  mkdirSync(join(cwd, "content/blogs"));
  writeFileSync(join(cwd, "content/home.md"), `${source}\n:::list blogs limit=1\n`);
  writeFileSync(
    join(cwd, "content/blogs/index.md"),
    `${source.replace("Building things", "Writing")}\n:::list blogs\n`,
  );
  const post = (title, date) =>
    `---\ntitle: ${title}\ndescription: Example article.\ndate: ${date}\ntags: [web]\n---\n\nExample body.\n\n\`\`\`js\nconst x=1;\n\`\`\`\n`;
  const first = join(cwd, "content/blogs/first.md");
  const second = join(cwd, "content/blogs/second.md");
  writeFileSync(first, post("First", "2026-01-01"));
  writeFileSync(second, post("Second", "2025-01-01"));
  const env = {
    ...fixtureEnv,
    NODE_ENV: "development",
    SITE_URL: "http://127.0.0.1:3456",
    SITE_OUTPUT_DIR: "dist/dev-3456",
  };
  const run = (flag) => {
    const result = spawnSync("bun", [join(cwd, "scripts/generate.mjs"), ...(flag ? [flag] : [])], {
      env,
      cwd,
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    return JSON.parse(result.stdout.match(/Computed (.+)/)[1]);
  };
  expect(run().html).toBe(4);
  expect(run()).toEqual({});
  const card = join(cwd, "dist/dev-3456/og/blogs/first/card.png");
  const cardTime = statSync(card).mtimeMs;
  writeFileSync(first, readFileSync(first, "utf8").replace("Example body", "Edited body"));
  expect(run()).toEqual({ html: 1 });
  expect(statSync(card).mtimeMs).toBe(cardTime);
  run("--check");
  writeFileSync(first, readFileSync(first, "utf8").replace("title: First", "title: Updated first"));
  const renamed = run();
  expect(renamed.html).toBe(4);
  expect(renamed.card).toBe(1);
  run("--check");
  renameSync(second, join(cwd, "content/blogs/renamed.md"));
  const orphan = spawnSync("bun", [join(cwd, "scripts/generate.mjs")], {
    env,
    cwd,
    encoding: "utf8",
  });
  expect(orphan.status).toBe(1);
  expect(orphan.stderr).toContain("Extra HTML without a Markdown source");
  run("--incremental");
  expect(existsSync(join(cwd, "dist/dev-3456/blogs/second/index.html"))).toBe(false);
  expect(existsSync(join(cwd, "dist/dev-3456/og/blogs/second/card.png"))).toBe(false);
  run("--check");
  const html = join(cwd, "dist/dev-3456/blogs/first/index.html");
  writeFileSync(html, "corrupt");
  writeFileSync(card, "corrupt");
  expect(run()).toEqual({});
  run("--check");
  rmSync(html);
  rmSync(card);
  expect(run()).toEqual({});
  run("--check");
  const footer = join(cwd, "layouts/partials/footer.html");
  writeFileSync(
    footer,
    readFileSync(footer, "utf8").replace("<footer", '<footer aria-label="Footer"'),
  );
  expect(run().html).toBe(4);
  run("--check");
  const config = join(cwd, "biome.json");
  writeFileSync(config, `${readFileSync(config, "utf8")}\n`);
  expect(run().html).toBe(4);
  run("--check");
  expect(existsSync(join(cwd, "pages/index.html"))).toBe(false);
}, 30000);

test("writing groups years newest first and shows exact publication dates", async () => {
  const pages = [
    { route: "/blogs/old/", metadata: { title: "Old", date: "2024-12-31" } },
    { route: "/blogs/new/", metadata: { title: "New", date: "2025-01-01" } },
    { route: "/blogs/later/", metadata: { title: "Later", date: "2025-03-02" } },
  ];
  const markdown = `${source}\n:::list blogs\n`;
  const html = await renderPage(markdown, { pages, route: "/blogs/" });
  const years = [...html.matchAll(/<h2\s+class="[^"]+"\s*>\s*(\d{4})\s*<\/h2>/g)].map(
    (match) => match[1],
  );
  expect(years).toEqual(["2025", "2024"]);
  expect(html).toContain('datetime="2025-01-01">Jan 1, 2025</time>');
  expect(html).toContain('datetime="2024-12-31">Dec 31, 2024</time>');
  expect(html.indexOf('href="/blogs/later/"')).toBeLessThan(html.indexOf('href="/blogs/new/"'));
  const home = await renderPage(markdown, { pages });
  expect(home).not.toMatch(/<h2\s+class="[^"]+"\s*>\s*\d{4}\s*<\/h2>/);
  expect(home).toContain('datetime="2025-01-01">Jan 1');
});

test("recent writing omits the current year and retains older years", async () => {
  const year = new Date().getUTCFullYear();
  const pages = [
    { route: "/blogs/current/", metadata: { title: "Current", date: `${year}-08-14` } },
    { route: "/blogs/previous/", metadata: { title: "Previous", date: `${year - 1}-12-31` } },
  ];
  const html = await renderPage(`${source}\n:::list blogs\n`, { pages });
  expect(html).toContain(`datetime="${year}-08-14">Aug 14</time>`);
  expect(html).toContain(`datetime="${year - 1}-12-31">Dec 31, ${year - 1}</time>`);
});
