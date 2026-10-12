import { expect, test } from "bun:test";
import { pageSource as source } from "../../test/lib/build-fixture.ts";
import { crawlerOutputs } from "../seo/crawler-outputs.ts";
import type { ListedPage, Site, SiteContext } from "../types.ts";
import { renderPage } from "./render-page.ts";

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
  const pages: ListedPage[] = [
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
  expect(html).toContain('<script type="module" src="/assets/embeds/image-carousel.js">');
  expect(await renderPage(`${source}\n![Single](/assets/a.webp)\n`)).not.toContain(
    "image-carousel.js",
  );
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
  const pages: ListedPage[] = [
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
  const site: Site = { url: "https://example.com", brand: "Example", articles: "/" };
  const pages: ListedPage[] = [
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
  const feed = String(crawlerOutputs(pages, site).get("feed.xml"));
  expect(feed.match(/<entry>/g)).toHaveLength(2);
  expect(feed).toContain("<id>https://example.com/topic/second/</id>");
  const { articles: _, ...withoutArticles } = site;
  expect(crawlerOutputs(pages, withoutArticles).has("feed.xml")).toBe(false);
});

test("lists from another site link to that site and show recent dates", async () => {
  const year = new Date().getUTCFullYear();
  const site: SiteContext = {
    external: {
      blog: [
        {
          route: "https://blog.example/old/",
          metadata: { title: "Old", date: `${year - 1}-12-31` },
        },
        { route: "https://blog.example/new/", metadata: { title: "New", date: `${year}-08-14` } },
      ],
    },
  };
  const html = await renderPage(`${source}\n:::list blog:all limit=5\n`, { site });
  expect(html.indexOf('href="https://blog.example/new/"')).toBeLessThan(
    html.indexOf('href="https://blog.example/old/"'),
  );
  expect(html).toContain(`datetime="${year}-08-14">Aug 14</time>`);
  expect(html).toContain(`datetime="${year - 1}-12-31">Dec 31, ${year - 1}</time>`);
  await expect(renderPage(`${source}\n:::list notes:all\n`, { site })).rejects.toThrow(
    "Unknown site in list directive: notes",
  );
});

test("code blocks indent line by line while keeping blank lines copyable", async () => {
  const html = await renderPage(`${source}\n\`\`\`text\nfirst\n\n  second\n\`\`\`\n`);
  expect(html).toMatch(
    /\n( +)<pre [^>]*whitespace-normal[^>]*>\n\1 {2}<code class="language-text [^"]*">\n\1 {4}<span class="block leading-\(--pre-line\) whitespace-pre">first<\/span>\n\1 {4}<span class="block leading-\(--pre-line\) whitespace-pre"><br \/><\/span>\n\1 {4}<span class="block leading-\(--pre-line\) whitespace-pre"> {2}second<\/span>\n\1 {2}<\/code>\n\1<\/pre>\n/,
  );
  expect(html).not.toMatch(/^\s*>|<\/[a-z]+$/m);
});

test("code blocks carry a sticky copy button and load its script once", async () => {
  const html = await renderPage(
    `${source}\n\`\`\`js\nconst a = 1;\n\`\`\`\n\n\`\`\`text\nsecond\n\`\`\`\n`,
  );
  expect(html.match(/<div class="relative [^"]*" data-code-block>/g)).toHaveLength(2);
  expect(
    html.match(/<button [^>]*class="[^"]*sticky top-3[^"]*"[^>]*data-code-copy>/g),
  ).toHaveLength(2);
  expect(html.match(/<script type="module" src="\/assets\/embeds\/code-copy\.js">/g)).toHaveLength(
    1,
  );
});

test("tables scroll sideways as a keyboard-focusable region without splitting words", async () => {
  const html = await renderPage(
    `${source}\n| Approach | Limit |\n| --- | --- |\n| Token bucket | 8000 |\n`,
  );
  expect(html).toMatch(/<table tabindex="0" class="[^"]*overflow-x-auto[^"]*wrap-normal/);
});
