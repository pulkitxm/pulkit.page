import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { timed, timedAsync } from "@pulkit/shared/duration";
import {
  type GenerationCache,
  generationCache,
  generationVersion,
} from "../lib/generation-cache.ts";
import { markdownOutputs } from "../markdown/markdown-export.ts";
import { renderDependencies } from "../render/render-dependencies.ts";
import { renderPage } from "../render/render-page.ts";
import { crawlerOutputs } from "../seo/crawler-outputs.ts";
import { cardOutputs } from "../seo/og-images.ts";
import { isNotFound, notFoundFile } from "../seo/routes.ts";
import type { Page, SiteInventory } from "../types.ts";
import { readSite } from "./site-inventory.ts";

function outputFor(route: string): string {
  return route === "/" ? "index.html" : `${route.slice(1)}index.html`;
}

export function renderSitePage(
  page: Page,
  { pages, layouts, site }: SiteInventory,
  cache: GenerationCache,
  onAccess?: Parameters<GenerationCache["getAsync"]>[3],
): Promise<string> {
  return cache.getAsync(
    "html",
    [page.route, page.text, [...layouts], site, renderDependencies(page, pages, site)],
    () => renderPage(page.text, { layouts, site, pages, route: page.route, cache }),
    onAccess,
  );
}

export async function generateSite(outputDirectory: string, origin: string): Promise<Page[]> {
  const { cache, inventory } = await timedAsync("Discovered source pages", async () => ({
    cache: generationCache(outputDirectory, generationVersion()),
    inventory: await readSite(origin),
  }));
  const { pages, site } = inventory;
  const outputs = await timedAsync<Map<string, string | Buffer>>(
    () => `Rendered ${pages.length} pages`,
    async () => {
      const rendered = new Map<string, string | Buffer>();
      for (const page of pages) {
        const html = await renderSitePage(page, inventory, cache);
        rendered.set(outputFor(page.route), html);
        if (isNotFound(page.route)) {
          rendered.set(notFoundFile, html);
        }
      }
      return rendered;
    },
  );
  timed("Rendered generated assets", () => {
    for (const generated of [
      cardOutputs(pages, site, cache),
      crawlerOutputs(pages, site),
      markdownOutputs(pages, site),
    ]) {
      for (const [path, bytes] of generated) {
        outputs.set(path, bytes);
      }
    }
  });
  timed(
    () => `Wrote ${outputs.size} files`,
    () => {
      for (const [path, contents] of outputs) {
        const file = join(outputDirectory, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, contents);
      }
      cache.save();
    },
  );
  console.log(`Computed ${JSON.stringify(cache.counts)}`);
  return pages;
}
