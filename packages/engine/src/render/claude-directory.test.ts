import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { HtmlValidate } from "html-validate";
import { renderMarkdown } from "../markdown/markdown-export.ts";
import type { DirectoryProject, Site } from "../types.ts";
import { renderPage } from "./render-page.ts";

const projects: DirectoryProject[] = Array.from({ length: 60 }, (_, index) => ({
  path: index < 50 ? `heroes/hero-${index}` : `templates/premium/acme/hero-${index}`,
  name: `hero-${index}`,
  title: `Hero ${index}`,
  category: index < 50 ? "Heroes & <friends>" : "Templates",
  group: index < 50 ? "heroes" : "templates",
  provider: index < 50 ? "" : "acme",
  blur: index === 0 ? "data:image/jpeg;base64,AAAA" : "",
  summary: `Hero number ${index}`,
  description: `The full story of hero number ${index}`,
  stack: "HTML",
  published: index !== 25,
}));

const site = { url: "https://example.invalid", directory: { projects, stars: 582 } } satisfies Site;

function source(directive: string): string {
  return `---\ntitle: Directory\nlayout: directory\ndescription: Every experiment.\n---\n${directive}\n`;
}

async function valid(html: string): Promise<boolean> {
  const config = JSON.parse(
    readFileSync(new URL("../../../../.htmlvalidate.json", import.meta.url), "utf8"),
  );
  return (await new HtmlValidate(config).validateString(html)).valid;
}

test("the first page shows the header, filters, 24 cards and page links", async () => {
  const html = await renderPage(source(":::claude-directory"), { site, route: "/directory/" });
  expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
  expect(html.match(/data-card-link/g)?.length).toBe(25);
  expect(html).toContain('data-stars="582"');
  expect(html).toContain("Report an issue");
  expect(html).toContain('data-filter="category:heroes"');
  expect(html).toContain('data-filter="premium"');
  expect(html).toContain('data-filter="provider:acme"');
  expect(html).toContain("Heroes &amp; &lt;friends&gt;");
  expect(html).toContain('href="/directory/hero-0/"');
  expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
  expect(html).toContain(
    'data-demo="https://claude-directory.pulkitxm.com/heroes/hero-0/demo.mp4"',
  );
  expect(html).toContain('href="/directory/2/"');
  expect(html).toContain('href="/directory/" aria-current="page"');
  expect(html).toContain('data-index="/directory/projects.json"');
  expect(await valid(html)).toBe(true);
});

test("a later page lists its own slice and an unpublished project has no demo", async () => {
  const html = await renderPage(source(":::claude-directory page=2"), {
    site,
    route: "/directory/2/",
  });
  expect(html).toContain(">Hero 24<");
  expect(html).not.toContain(">Hero 23<");
  expect(html).toContain('href="/directory/2/" aria-current="page"');
  expect(html).toContain("Demo unavailable");
  expect(html).not.toContain("heroes/hero-25/demo.mp4");
});

test("a page past the end fails the build", () => {
  expect(
    renderPage(source(":::claude-directory page=4"), { site, route: "/directory/4/" }),
  ).rejects.toThrow("no page 4");
});

test("a project page shows its demo, actions and neighbours", async () => {
  const html = await renderPage(source(":::claude-directory project=hero-30"), {
    site,
    route: "/directory/hero-30/",
  });
  expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
  expect(html).toContain(">Hero 30<");
  expect(html).toContain("https://claude-directory.pulkitxm.com/heroes/hero-30/demo.mp4");
  expect(html).toContain(
    'data-prompt="https://raw.githubusercontent.com/pulkitxm/claude-directory/main/heroes/hero-30/prompt.md"',
  );
  expect(html).toContain('href="https://claude-directory.pulkitxm.com/heroes/hero-30/"');
  expect(html).toContain('href="/directory/hero-29/" aria-label="Previous project"');
  expect(html).toContain('href="/directory/hero-31/" aria-label="Next project"');
  expect(html).toContain('data-project-path="heroes/hero-30"');
  expect(await valid(html)).toBe(true);
});

test("an unpublished project page has no demo or live preview", async () => {
  const html = await renderPage(source(":::claude-directory project=hero-25"), {
    site,
    route: "/directory/hero-25/",
  });
  expect(html).not.toContain("demo.mp4");
  expect(html).not.toContain("Open live preview");
  expect(html).toContain("No preview available");
});

test("Markdown copies list a page's projects and carry each project's details", () => {
  const pages = ["/directory/", "/directory/2/", "/directory/3/"].map((route) => ({
    route,
    metadata: { title: "Directory" },
  }));
  const page = renderMarkdown(
    {
      route: "/directory/2/",
      metadata: { title: "Directory" },
      body: ":::claude-directory page=2\n",
    },
    pages,
    site,
  );
  expect(page).toContain("Page 2 of 3, 60 projects in all.");
  expect(page).toContain("[hero-24](https://example.invalid/directory/hero-24/)");
  expect(page).toContain("[Previous page](https://example.invalid/directory.md)");
  expect(page).toContain("[Next page](https://example.invalid/directory/3.md)");
  const project = renderMarkdown(
    {
      route: "/directory/hero-30/",
      metadata: { title: "Hero 30" },
      body: ":::claude-directory project=hero-30\n",
    },
    pages,
    site,
  );
  expect(project).toContain("The full story of hero number 30");
  expect(project).toContain("- Stack: HTML");
  expect(project).toContain("[All projects](https://example.invalid/directory.md)");
});
