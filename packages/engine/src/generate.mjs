import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { logDuration } from "./duration.mjs";
import { generationCache, generationVersion } from "./generation-cache.mjs";
import { seoOutputs } from "./og-images.mjs";
import { renderDependencies, renderPage } from "./render-page.mjs";
import { readSite } from "./site-inventory.mjs";

function outputFor(route) {
  return route === "/" ? "index.html" : `${route.slice(1)}index.html`;
}

export async function generateSite(outputDirectory, origin) {
  let stepStartedAt = performance.now();
  const cache = generationCache(outputDirectory, generationVersion());
  const { pages, layouts, site } = readSite(origin);
  logDuration("Discovered source pages", stepStartedAt);
  stepStartedAt = performance.now();
  const outputs = new Map();
  for (const page of pages) {
    outputs.set(
      outputFor(page.route),
      await cache.get(
        "html",
        [page.route, page.text, [...layouts], site, renderDependencies(page, pages, site)],
        () => renderPage(page.text, { layouts, site, pages, route: page.route, cache }),
      ),
    );
  }
  logDuration(`Rendered ${pages.length} pages`, stepStartedAt);
  stepStartedAt = performance.now();
  for (const [path, bytes] of seoOutputs(pages, site, cache)) {
    outputs.set(path, bytes);
  }
  logDuration("Rendered generated assets", stepStartedAt);
  stepStartedAt = performance.now();
  for (const [path, contents] of outputs) {
    const file = join(outputDirectory, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
  cache.save();
  logDuration(`Wrote ${outputs.size} files`, stepStartedAt);
  console.log(`Computed ${JSON.stringify(cache.counts)}`);
  return pages;
}
