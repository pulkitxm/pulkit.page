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
  expect(html).toMatch(
    /<script type="module" src="\/assets\/embeds\/image-carousel\.js" fetchpriority="low">/,
  );
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

test("gallery directives render a zoomable photo grid and reject stray content", async () => {
  const images = ["First", "Second"].map((alt) => `![${alt}](/assets/${alt}.webp)`).join("\n\n");
  const html = await renderPage(`${source}\n:::gallery\n\n${images}\n\n:::\n`);
  expect(html.match(/data-gallery-image/g)).toHaveLength(2);
  expect(html.match(/data-media-zoom/g)).toHaveLength(2);
  expect(html).toContain('alt="Second"');
  expect(html).not.toContain("image-carousel.js");
  await expect(renderPage(`${source}\n:::gallery\n\n${images}\n\nText\n\n:::\n`)).rejects.toThrow(
    "Invalid gallery directive",
  );
});

test("galleries mix photos with lazy video previews and playable fallback links", async () => {
  const html = await renderPage(
    `${source}\n:::gallery\n\n![Photo](/assets/photo.webp)\n\n![Awards ceremony](/assets/video-1.mp4)\n\n:::\n`,
  );
  expect(html.match(/data-media-zoom/g)).toHaveLength(1);
  expect(html).toContain('href="/assets/video-1.mp4" aria-label="Play Awards ceremony"');
  expect(html).toContain('data-video-preview="/assets/video-1-preview.mp4"');
  expect(html).toContain('src="/assets/video-1-poster.webp"');
  expect(html).not.toContain("<video");
  expect(html).not.toContain(
    '<img class="m-0 block size-full object-cover" src="/assets/video-1.mp4"',
  );
  expect(html).toContain("/assets/embeds/lightbox.js");
});

test("event pages render with an empty description", async () => {
  const html = await renderPage('---\ntitle: Awards ceremony\ndescription: ""\n---\n\nPhotos.\n', {
    site: { description: "Portfolio overview" },
  });
  expect(html).toContain("Awards ceremony");
  expect(html).toMatch(/name="description" content="Awards ceremony"/);
});

test("galleries support a single photo or video without creating idle video elements", async () => {
  for (const src of ["/assets/photo.webp", "/assets/clip.mp4"]) {
    const html = await renderPage(
      `---\ntitle: Event\n---\n\n:::gallery\n\n![Event](${src})\n\n:::\n`,
    );
    expect(html.match(/data-gallery-image/g)).toHaveLength(1);
    expect(html).toContain(`href="${src}"`);
    expect(html).not.toContain("<video");
  }
});

test("grid lists render cover cards, prioritize the leading covers of full lists, and require covers", async () => {
  const pages: ListedPage[] = [
    {
      route: "/events/old/",
      metadata: { title: "Old", date: "2024-03-07", cover: "/assets/old.webp" },
    },
    {
      route: "/events/new/",
      metadata: {
        title: "New",
        description: "A <new> event.",
        date: "2025-04-11",
        cover: "/assets/new.webp",
      },
    },
  ];
  const html = await renderPage(`${source}\n:::list events grid\n`, { pages, route: "/events/" });
  expect(html.match(/data-gallery-image/g)).toHaveLength(2);
  expect(html).toContain('src="/assets/new.webp"');
  expect(html).toContain("A &lt;new&gt; event.");
  expect(html).toContain('datetime="2025-04-11">Apr 2025</time>');
  expect(html.indexOf('href="/events/new/"')).toBeLessThan(html.indexOf('href="/events/old/"'));
  expect(html.match(/fetchpriority="high"/g)).toHaveLength(2);
  const recent = await renderPage(`${source}\n:::list events limit=2 grid\n`, { pages });
  expect(recent).not.toContain('fetchpriority="high"');
  const grouped = await renderPage(`${source}\n:::list events by-year grid\n`, { pages });
  expect(grouped).toMatch(/<h2\s+class="[^"]+"\s*>\s*2025\s*<\/h2>/);
  const uncovered: ListedPage[] = [{ route: "/events/bare/", metadata: { title: "Bare" } }];
  await expect(
    renderPage(`${source}\n:::list events grid\n`, { pages: uncovered }),
  ).rejects.toThrow("Grid list entry needs a cover image: /events/bare/");
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
  expect(
    html.match(/<script type="module" src="\/assets\/embeds\/code-copy\.js" fetchpriority="low">/g),
  ).toHaveLength(1);
});

test("tables scroll sideways as a keyboard-focusable region without splitting words", async () => {
  const html = await renderPage(
    `${source}\n| Approach | Limit |\n| --- | --- |\n| Token bucket | 8000 |\n`,
  );
  expect(html).toMatch(/<table tabindex="0" class="[^"]*overflow-x-auto[^"]*wrap-normal/);
});

test("comparison tables with an empty corner use row headers without changing their weight", async () => {
  const html = await renderPage(
    `${source}\n| | Single | Multiple |\n| --- | --- | --- |\n| Sharded | One | Many |\n| Unsharded | One | Many |\n`,
  );
  expect(html.match(/<th scope="row"/g)).toHaveLength(2);
  expect(html.match(/<th scope="col"/g)).toHaveLength(3);
  expect(html).toMatch(/<th scope="row" class="font-normal [^"]*">Sharded<\/th>/);
  expect(html).toMatch(/<td[^>]*>One<\/td>/);
  const ordinary = await renderPage(`${source}\n| Name | Value |\n| --- | --- |\n| A | B |\n`);
  expect(ordinary).not.toContain('scope="row"');
});

test("only images at the start of page content receive loading priority", async () => {
  const imagePage = "---\ntitle: Images\n---\n";
  for (const first of [
    "![Leading](/assets/leading.webp)",
    "[![Leading](/assets/leading.webp)](https://example.com)",
  ]) {
    const html = await renderPage(`${imagePage}\n\n${first}\n\n![Later](/assets/later.webp)\n`);
    expect(html.match(/<img[^>]+alt="Leading"[^>]*>/)?.[0]).toContain('loading="eager"');
    expect(html.match(/<img[^>]+alt="Leading"[^>]*>/)?.[0]).toContain('fetchpriority="high"');
    expect(html.match(/<img[^>]+alt="Later"[^>]*>/)?.[0]).toContain('loading="lazy"');
    expect(html.match(/fetchpriority="high"/g)).toHaveLength(1);
  }
  for (const introduction of [
    "Introduction",
    "## Heading",
    "Introduction ![Inline](/assets/inline.webp)",
  ]) {
    const html = await renderPage(
      `${imagePage}\n\n${introduction}\n\n![Later](/assets/later.webp)\n`,
    );
    expect(html.match(/<img[^>]+alt="Later"[^>]*>/)?.[0]).toContain('loading="lazy"');
    expect(html).not.toContain('fetchpriority="high"');
  }
});

test("explicit image priority selects one image without changing its lightbox or styling", async () => {
  const body = [
    "Introduction.",
    "![Selected](/assets/selected.webp)",
    "![Later](/assets/later.webp)",
  ].join("\n\n");
  const imageSource = "---\ntitle: Images\n---\n";
  const normal = await renderPage(`${imageSource}${body}`);
  const prioritized = await renderPage(
    `---\ntitle: Images\npriorityImage: /assets/selected.webp\n---\n${body}`,
  );
  expect(prioritized).toBe(
    normal.replace(
      'alt="Selected" loading="lazy"',
      'alt="Selected" loading="eager" fetchpriority="high"',
    ),
  );
  expect(prioritized.match(/fetchpriority="high"/g)).toHaveLength(1);
  expect(prioritized.match(/<img[^>]+alt="Later"[^>]*>/)?.[0]).toContain('loading="lazy"');
  expect(prioritized).toContain('href="/assets/selected.webp"');
  const explicit = await renderPage(
    [
      "---\ntitle: Images\npriorityImage: /assets/later.webp\n---",
      "![Leading](/assets/leading.webp)",
      "![Later](/assets/later.webp)",
    ].join("\n\n"),
  );
  expect(explicit.match(/<img[^>]+alt="Leading"[^>]*>/)?.[0]).toContain('loading="lazy"');
  expect(explicit.match(/fetchpriority="high"/g)).toHaveLength(1);
});

test("section directives wrap nested Markdown and directives in a named section", async () => {
  const html = await renderPage(
    [
      "---",
      "title: Sections",
      "---",
      "",
      "::::section intro",
      "",
      "## Hello",
      "",
      "Some **text**.",
      "",
      "::::",
      "",
    ].join("\n"),
  );
  expect(html).toMatch(/<section class="[^"]*" data-section="intro">/);
  expect(html).toContain("<strong>text</strong>");
  expect(html).toMatch(/data-section="intro">\s*<h2/);
  await expect(renderPage("---\ntitle: Broken\n---\n\n::::section Bad\n\ntext\n")).rejects.toThrow(
    "Invalid section directive",
  );
});
