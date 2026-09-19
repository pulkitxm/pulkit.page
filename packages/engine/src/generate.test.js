import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { checkLayouts } from "./check-layouts.mjs";
import { loadLayouts } from "./layouts.mjs";
import { crawlerOutputs } from "./og-images.mjs";
import { renderPage } from "./render-page.mjs";

const engine = import.meta.dir;
const fixture = resolve(import.meta.dir, "../test/fixture");
const source =
  "---\ntitle: Building things\ndescription: Example page.\nlayout: home\n---\n\nSoftware engineer based in India.\n";
const temporary = [];
const fixtureEnv = { ...process.env, NODE_ENV: "production", SITE_URL: "" };

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), "homepage-test-"));
  temporary.push(directory);
  cpSync(join(fixture, "layouts"), join(directory, "layouts"), { recursive: true });
  mkdirSync(join(directory, "content"));
  writeFileSync(join(directory, "CNAME"), "example.com\n");
  mkdirSync(join(directory, "assets"));
  writeFileSync(join(directory, "content/_site.md"), "---\nbrand: Pulkit\n---\n");
  return directory;
}

function project() {
  const directory = workspace();
  writeFileSync(join(directory, "assets/example.txt"), "asset");
  writeFileSync(join(directory, "vercel.json"), '{"trailingSlash":true}\n');
  writeFileSync(join(directory, "styles.css"), "");
  writeFileSync(join(directory, "content/home.md"), source);
  return directory;
}

function build(cwd, env = fixtureEnv) {
  return spawnSync("bun", [join(engine, "build.mjs")], { env, cwd, encoding: "utf8" });
}

function computed(result) {
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout.match(/Computed (.+)/)[1]);
}

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("build renders nested routes, crawler files, cards, assets and fingerprinted styles", () => {
  const cwd = project();
  mkdirSync(join(cwd, "content/notes"));
  writeFileSync(
    join(cwd, "content/notes/example.md"),
    source.replace("layout: home", "layout: simple").replace("Building things", "Example"),
  );
  mkdirSync(join(cwd, "dist/dev-3456"), { recursive: true });
  writeFileSync(join(cwd, "dist/dev-3456/index.html"), "running preview");
  writeFileSync(join(cwd, "dist/stale.html"), "stale");
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
  expect(readFileSync(join(cwd, "dist/vercel.json"), "utf8")).toBe('{"trailingSlash":true}\n');
  expect(existsSync(join(cwd, "dist/CNAME"))).toBe(false);
  expect(readFileSync(join(cwd, "dist/dev-3456/index.html"), "utf8")).toBe("running preview");
  expect(existsSync(join(cwd, "dist/stale.html"))).toBe(false);
  const built = readFileSync(join(cwd, "dist/index.html"), "utf8");
  const [, styles] = built.match(/href="\/(styles\.[0-9a-f]{12}\.css)"/);
  const [, theme] = built.match(/src="\/(theme\.[0-9a-f]{12}\.js)"/);
  expect(existsSync(join(cwd, "dist", styles))).toBe(true);
  expect(existsSync(join(cwd, "dist", theme))).toBe(true);
  expect(existsSync(join(cwd, "dist/styles.css"))).toBe(false);
  rmSync(join(cwd, "content/notes/example.md"));
  expect(build(cwd).status).toBe(0);
  expect(existsSync(join(cwd, "dist/notes/example/index.html"))).toBe(false);
  expect(readFileSync(join(cwd, "dist/sitemap.xml"), "utf8")).not.toContain("/notes/");
}, 30000);

test("preview builds use their own origin", () => {
  const cwd = project();
  const result = build(cwd, {
    ...fixtureEnv,
    NODE_ENV: "staging",
    SITE_URL: "https://preview.example",
  });
  expect(result.status).toBe(0);
  const html = readFileSync(join(cwd, "dist/index.html"), "utf8");
  expect(html).toContain('href="https://preview.example/"');
  expect(html).toContain('content="https://preview.example/og/home/card.png"');
  expect(html).not.toContain("https://example.com");
  expect(readFileSync(join(cwd, "dist/sitemap.xml"), "utf8")).toContain(
    "<loc>https://preview.example/</loc>",
  );
}, 30000);

test("conflicting routes and unsupported MDX fail the build", () => {
  const cwd = project();
  writeFileSync(join(cwd, "content/index.md"), source);
  expect(build(cwd).stderr).toContain("Multiple Markdown sources map to /");
  rmSync(join(cwd, "content/index.md"));
  writeFileSync(join(cwd, "content/article.mdx"), source);
  expect(build(cwd).stderr).toContain("MDX is not supported");
}, 30000);

test("rebuilds reuse cached renders and invalidate on content and layout edits", () => {
  const cwd = project();
  writeFileSync(join(cwd, "content/_site.md"), "---\nbrand: Pulkit\narticles: /blogs/\n---\n");
  mkdirSync(join(cwd, "content/blogs"));
  writeFileSync(join(cwd, "content/home.md"), `${source}\n:::list blogs limit=1\n`);
  writeFileSync(
    join(cwd, "content/blogs/index.md"),
    `${source.replace("Building things", "Writing")}\n:::list blogs\n`,
  );
  const post = (title, date) =>
    `---\ntitle: ${title}\ndescription: Example article.\ndate: ${date}\ntags: [web]\n---\n\nExample body.\n\n\`\`\`js\nconst x=1;\n\`\`\`\n`;
  const first = join(cwd, "content/blogs/first.md");
  writeFileSync(first, post("First", "2026-01-01"));
  writeFileSync(join(cwd, "content/blogs/second.md"), post("Second", "2025-01-01"));
  expect(computed(build(cwd)).html).toBe(4);
  expect(computed(build(cwd))).toEqual({});
  writeFileSync(first, readFileSync(first, "utf8").replace("Example body", "Edited body"));
  expect(computed(build(cwd))).toEqual({ html: 1 });
  writeFileSync(first, readFileSync(first, "utf8").replace("title: First", "title: Updated first"));
  const renamed = computed(build(cwd));
  expect(renamed.html).toBe(4);
  expect(renamed.card).toBe(1);
  const footer = join(cwd, "layouts/partials/footer.html");
  writeFileSync(
    footer,
    readFileSync(footer, "utf8").replace("<footer", '<footer aria-label="Footer"'),
  );
  expect(computed(build(cwd)).html).toBe(4);
}, 60000);

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

test("HTML formatting preserves check marks in highlighted shell transcripts", async () => {
  const html = await renderPage(
    `${source}\n\n\`\`\`bash\n\u2714 Would you like TypeScript?\n\`\`\`\n`,
  );
  expect(html).toContain("&#10004;");
  expect(html).not.toContain("√");
});

test("by-year lists group newest first with day and month dates", async () => {
  const pages = [
    { route: "/blogs/old/", metadata: { title: "Old", date: "2024-12-31" } },
    { route: "/blogs/new/", metadata: { title: "New", date: "2025-01-01" } },
    { route: "/blogs/later/", metadata: { title: "Later", date: "2025-03-02" } },
  ];
  const html = await renderPage(`${source}\n:::list blogs by-year\n`, { pages, route: "/blogs/" });
  const years = [...html.matchAll(/<h2\s+class="[^"]+"\s*>\s*(\d{4})\s*<\/h2>/g)].map(
    (match) => match[1],
  );
  expect(years).toEqual(["2025", "2024"]);
  expect(html).toContain('datetime="2025-01-01">Jan 1</time>');
  expect(html).toContain('datetime="2024-12-31">Dec 31</time>');
  expect(html.indexOf('href="/blogs/later/"')).toBeLessThan(html.indexOf('href="/blogs/new/"'));
  const plain = await renderPage(`${source}\n:::list blogs\n`, { pages });
  expect(plain).not.toMatch(/<h2\s+class="[^"]+"\s*>\s*\d{4}\s*<\/h2>/);
  expect(plain).toContain('datetime="2025-01-01">Jan 2025</time>');
});

test("sites with articles list every post, render article meta and publish a feed", async () => {
  const site = { url: "https://example.com", brand: "Example", articles: "/" };
  const pages = [
    { route: "/", metadata: { title: "Home" } },
    { route: "/topic/", index: true, metadata: { title: "Topic" } },
    { route: "/first/", metadata: { title: "First", description: "One.", date: "2025-01-01" } },
    {
      route: "/topic/second/",
      metadata: { title: "Second", description: "Two.", date: "2026-02-03" },
    },
  ];
  const home = await renderPage(`${source}\n:::list all by-year\n`, { pages, site });
  expect(home.indexOf('href="/topic/second/"')).toBeLessThan(home.indexOf('href="/first/"'));
  expect(home).not.toContain('href="/topic/"');
  const article = await renderPage(
    "---\ntitle: Second\ndescription: Two.\ndate: 2026-02-03\n---\n\nShort body.\n",
    { pages, site, route: "/topic/second/" },
  );
  expect(article).toContain("February 3, 2026");
  expect(article).toContain("1 min read");
  expect(article).toContain('href="/topic/"');
  const feed = crawlerOutputs(pages, site).get("feed.xml").toString();
  expect(feed.match(/<entry>/g)).toHaveLength(2);
  expect(feed).toContain("<id>https://example.com/topic/second/</id>");
  expect(crawlerOutputs(pages, { ...site, articles: undefined }).has("feed.xml")).toBe(false);
});
