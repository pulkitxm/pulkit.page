import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { timed, timedAsync } from "@pulkit/shared/duration";
import { generationCache, generationVersion } from "./generation-cache.mjs";
import { seoOutputs } from "./og-images.mjs";
import { renderDependencies, renderPage } from "./render-page.mjs";
import { readSite } from "./site-inventory.mjs";

function outputFor(route) {
  return route === "/" ? "index.html" : `${route.slice(1)}index.html`;
}

export async function generateSite(outputDirectory, origin) {
  const { cache, pages, layouts, site } = timed("Discovered source pages", () => ({
    cache: generationCache(outputDirectory, generationVersion()),
    ...readSite(origin),
  }));
  const outputs = await timedAsync(
    () => `Rendered ${pages.length} pages`,
    async () => {
      const rendered = new Map();
      for (const page of pages) {
        rendered.set(
          outputFor(page.route),
          await cache.get(
            "html",
            [page.route, page.text, [...layouts], site, renderDependencies(page, pages, site)],
            () => renderPage(page.text, { layouts, site, pages, route: page.route, cache }),
          ),
        );
      }
      return rendered;
    },
  );
  timed("Rendered generated assets", () => {
    for (const [path, bytes] of seoOutputs(pages, site, cache)) {
      outputs.set(path, bytes);
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
