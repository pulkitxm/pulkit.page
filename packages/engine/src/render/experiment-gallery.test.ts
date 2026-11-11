import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { experimentPreview, experimentSource } from "@pulkit/shared/experiments";
import { HtmlValidate } from "html-validate";
import { renderMarkdown } from "../markdown/markdown-export.ts";
import type { DirectoryProject, Site } from "../types.ts";
import { renderPage } from "./render-page.ts";

const projects: DirectoryProject[] = Array.from({ length: 60 }, (_, index) => {
  const path = `hero-sections/mock-${index}`;
  return {
    path,
    name: path.replaceAll("/", "--"),
    title: `Sample project ${index}`,
    category: "Hero sections",
    group: "hero-sections",
    summary: `Synthetic example ${index}`,
    description: `Independent synthetic example ${index} for gallery verification.`,
    thumbnail:
      index === 0 ? "/assets/experiment-artwork/hero-sections--mock-0/original-visual.svg" : "",
    hue: index * 5,
    source: experimentSource(path),
    preview: experimentPreview(path),
  };
});
const revision = "a".repeat(40);
const site = {
  url: "https://example.test",
  directory: { projects, stars: 42, revision },
} satisfies Site;
const source = (directive: string) =>
  `---\ntitle: UI experiments\nlayout: directory\ndescription: Reviewed synthetic examples.\n---\n${directive}\n`;
async function valid(html: string): Promise<boolean> {
  const config = JSON.parse(
    readFileSync(new URL("../../../../.htmlvalidate.json", import.meta.url), "utf8"),
  );
  return (await new HtmlValidate(config).validateString(html)).valid;
}

test("renders the owned gallery layout with reviewed artwork, filters and current links", async () => {
  const html = await renderPage(source(":::experiment-gallery"), { site, route: "/directory/" });
  expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  expect(html.match(/data-card-link/g)).toHaveLength(25);
  expect(html).toContain(">UI experiments</h1>");
  expect(html).toContain('data-filter="category:hero-sections"');
  expect(html).toContain('href="/directory/experiments/hero-sections--mock-0/"');
  expect(html).toContain(
    'src="/assets/experiment-artwork/hero-sections--mock-0/original-visual.svg"',
  );
  expect(html).toContain('href="/directory/pages/2/"');
  expect(html).toContain(`data-index="/directory/reviewed-projects.json?v=${revision}"`);
  expect(html).toContain("https://claude-directory.pulkitxm.com/hero-sections/mock-0/");
  expect(html).toContain(
    "https://github.com/pulkitxm/claude-directory/tree/main/hero-sections/mock-0",
  );
  for (const retired of [
    "demo.mp4",
    "poster.jpg",
    "data-prompt",
    "download-directory",
    "raw.githubusercontent",
    'data-filter="premium"',
    'data-filter="provider:',
  ]) {
    expect(html).not.toContain(retired);
  }
  expect(await valid(html)).toBe(true);
});

test("renders later pages and original CSS artwork without requesting absent images", async () => {
  const html = await renderPage(source(":::experiment-gallery page=2"), {
    site,
    route: "/directory/pages/2/",
  });
  expect(html).toContain(">Sample project 24<");
  expect(html).not.toContain(">Sample project 23<");
  expect(html).toContain("data-artwork-css");
  expect(html).not.toContain('src=""');
  expect(html).toContain('href="/directory/pages/2/" aria-current="page"');
  expect(html).not.toContain("<video");
  expect(await valid(html)).toBe(true);
});

test("fails instead of generating pages outside the approved catalog", async () => {
  await expect(
    renderPage(source(":::experiment-gallery page=4"), { site, route: "/directory/pages/4/" }),
  ).rejects.toThrow("no page 4");
  await expect(
    renderPage(source(":::experiment-gallery project=missing"), {
      site,
      route: "/directory/experiments/missing/",
    }),
  ).rejects.toThrow("no project missing");
});

test("project details retain current preview, source and neighbour navigation without legacy media", async () => {
  const html = await renderPage(source(":::experiment-gallery project=hero-sections--mock-30"), {
    site,
    route: "/directory/experiments/hero-sections--mock-30/",
  });
  expect(html).toContain(">Sample project 30<");
  expect(html).toContain('href="/directory/"');
  expect(html).toContain(
    'href="/directory/experiments/hero-sections--mock-29/" aria-label="Previous project"',
  );
  expect(html).toContain(
    'href="/directory/experiments/hero-sections--mock-31/" aria-label="Next project"',
  );
  expect(html).toContain("Open current preview");
  expect(html).toContain("Source folder");
  expect(html).toContain("Asset provenance");
  for (const retired of [
    "<video",
    "<iframe",
    "data-project-view",
    "data-prompt",
    "Download",
    "demo.mp4",
    "poster.jpg",
    "raw.githubusercontent",
  ]) {
    expect(html).not.toContain(retired);
  }
  expect(await valid(html)).toBe(true);
});

test("Markdown exports link to reviewed current sources without prompt or archive copying", () => {
  const pages = [{ route: "/directory/", metadata: { title: "UI experiments" } }];
  const markdown = renderMarkdown(
    {
      route: "/directory/experiments/hero-sections--mock-30/",
      metadata: { title: "Sample project" },
      body: ":::experiment-gallery project=hero-sections--mock-30\n",
    },
    pages,
    site,
  );
  expect(markdown).toContain("Independent synthetic example 30");
  expect(markdown).toContain(
    "[Current preview](https://claude-directory.pulkitxm.com/hero-sections/mock-30/)",
  );
  expect(markdown).toContain("[All projects](https://example.test/directory.md)");
  expect(markdown).not.toContain("Prompt");
  expect(markdown).not.toContain("Download");
});
