import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { HtmlValidate } from "html-validate";
import { renderMarkdown } from "../markdown/markdown-export.ts";
import type { DirectoryProject, Site } from "../types.ts";
import { renderPage } from "./render-page.ts";

const directory: DirectoryProject[] = Array.from({ length: 60 }, (_, index) => ({
  path: `heroes/hero-${index}`,
  name: `hero-${index}`,
  category: "Heroes & <friends>",
  summary: `Hero number ${index}`,
  description: `The full story of hero number ${index}`,
  stack: "HTML",
  published: index !== 25,
}));

const site = { url: "https://example.invalid", directory } satisfies Site;

function source(page?: number): string {
  return `---\ntitle: Directory\ndescription: Every experiment.\n---\n:::claude-directory${page ? ` page=${page}` : ""}\n`;
}

test("the first page lists 24 projects, the search box, and links to later pages", async () => {
  const html = await renderPage(source(), { site, route: "/directory/" });
  expect(html.match(/data-card-link/g)?.length).toBe(25);
  expect(html).toContain("Showing 1 to 24 of 60 projects");
  expect(html).toContain('data-index="/directory/projects.json"');
  expect(html).toContain('href="/directory/2/"');
  expect(html).toContain('href="/directory/3/"');
  expect(html).toContain('href="/directory/" aria-current="page"');
  expect(html).toContain("Heroes &amp; &lt;friends&gt;");
  expect(html).toContain("https://claude-directory.pulkitxm.com/heroes/hero-0/poster.jpg");
  expect(html).toContain('href="/directory/hero-0/"');
  expect(html).toContain('data-base="/directory/"');
  expect(html).toContain('src="/assets/embeds/claude-directory.js"');
  const config = JSON.parse(
    readFileSync(new URL("../../../../.htmlvalidate.json", import.meta.url), "utf8"),
  );
  const report = await new HtmlValidate(config).validateString(html);
  expect(report.valid).toBe(true);
});

test("a later page lists its own slice and marks itself current", async () => {
  const html = await renderPage(source(2), { site, route: "/directory/2/" });
  expect(html).toContain("Showing 25 to 48 of 60 projects");
  expect(html).toContain(">hero-24<");
  expect(html).not.toContain(">hero-23<");
  expect(html).toContain('href="/directory/2/" aria-current="page"');
  expect(html).toContain('href="/directory/"');
  expect(html).toContain('data-index="/directory/projects.json"');
  expect(html).toContain("No preview");
});

test("a page past the end fails the build", () => {
  expect(renderPage(source(4), { site, route: "/directory/4/" })).rejects.toThrow("no page 4");
});

test("Markdown copies list the page's projects and the neighbouring pages", () => {
  const pages = ["/directory/", "/directory/2/", "/directory/3/"].map((route) => ({
    route,
    metadata: { title: "Directory" },
  }));
  const markdown = renderMarkdown(
    {
      route: "/directory/2/",
      metadata: { title: "Directory" },
      body: ":::claude-directory page=2\n",
    },
    pages,
    site,
  );
  expect(markdown).toContain("Page 2 of 3, 60 projects in all.");
  expect(markdown).toContain("[hero-24](https://example.invalid/directory/hero-24/)");
  expect(markdown).not.toContain("hero-23]");
  expect(markdown).toContain("[Previous page](https://example.invalid/directory.md)");
  expect(markdown).toContain("[Next page](https://example.invalid/directory/3.md)");
});

test("a project page shows its demo, details, actions and neighbours", async () => {
  const html = await renderPage(
    "---\ntitle: hero-30\ndescription: The full story.\n---\n:::claude-directory project=hero-30\n",
    { site, route: "/directory/hero-30/" },
  );
  expect(html).toContain("https://claude-directory.pulkitxm.com/heroes/hero-30/demo.mp4");
  expect(html).toContain("The full story of hero number 30");
  expect(html).toContain("Heroes &amp; &lt;friends&gt;");
  expect(html).toContain(
    'data-prompt="https://raw.githubusercontent.com/pulkitxm/claude-directory/main/heroes/hero-30/prompt.md"',
  );
  expect(html).toContain('href="https://claude-directory.pulkitxm.com/heroes/hero-30/"');
  expect(html).toContain('href="/directory/hero-29/"');
  expect(html).toContain('href="/directory/hero-31/"');
  expect(html).toContain('href="/directory/2/">Back to page 2');
});

test("an unpublished project has no demo or live preview", async () => {
  const html = await renderPage(
    "---\ntitle: hero-25\ndescription: The full story.\n---\n:::claude-directory project=hero-25\n",
    { site, route: "/directory/hero-25/" },
  );
  expect(html).not.toContain("demo.mp4");
  expect(html).not.toContain("Open live preview");
  expect(html).toContain("No preview");
});

test("project Markdown copies carry the description and links", () => {
  const markdown = renderMarkdown(
    {
      route: "/directory/hero-30/",
      metadata: { title: "hero-30" },
      body: ":::claude-directory project=hero-30\n",
    },
    [{ route: "/directory/", metadata: { title: "Directory" } }],
    site,
  );
  expect(markdown).toContain("The full story of hero number 30");
  expect(markdown).toContain("- Stack: HTML");
  expect(markdown).toContain("[All projects](https://example.invalid/directory.md)");
});
