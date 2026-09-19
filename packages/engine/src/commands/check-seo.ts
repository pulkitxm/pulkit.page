import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isArticle } from "../seo/routes.ts";
import { validateSeo } from "../seo/validate-seo.ts";
import { readPages, readSiteConfig } from "../site/site-inventory.ts";
import { resolveSiteOrigin } from "../site/site-origin.ts";
import type { Page, Site } from "../types.ts";

const root = "dist";

function sortedText(values: readonly string[]): string {
  return JSON.stringify(values.toSorted((a, b) => a.localeCompare(b)));
}

function checkPage(page: Page, site: Site): void {
  const html = readFileSync(join(root, page.route, "index.html"), "utf8");
  validateSeo(html, page.route, page.metadata, site, (path) => readFileSync(join(root, path)));
  for (const [, href = ""] of html.matchAll(/href="(https?:\/\/[^"#]+)(?:#[^"]*)?"/g)) {
    const target = new URL(href);
    if (
      target.origin === site.url &&
      !existsSync(join(root, target.pathname, "index.html")) &&
      !existsSync(join(root, target.pathname))
    ) {
      throw new Error(`${page.source}: unresolved canonical link ${target.href}`);
    }
  }
}

function checkFeed(pages: readonly Page[], site: Site): void {
  const feedPath = join(root, "feed.xml");
  if (!site.articles) {
    if (existsSync(feedPath)) {
      throw new Error("Only sites with articles publish a feed");
    }
    return;
  }
  const expected = pages
    .filter((page) => isArticle(page.route, pages, site))
    .map((page) => site.url + page.route);
  const feed = existsSync(feedPath) ? readFileSync(feedPath, "utf8") : "";
  const ids = [...feed.matchAll(/<entry>\s*<title>[^<]*<\/title>\s*<id>([^<]+)<\/id>/g)].map(
    ([, id = ""]) => id,
  );
  if (sortedText(ids) !== sortedText(expected)) {
    throw new Error("Feed must contain every article exactly once");
  }
}

const siteConfig = readSiteConfig(resolveSiteOrigin());
const sitePages = readPages(".");
const titles = new Set<string>();
const descriptions = new Set<string | undefined>();
for (const page of sitePages) {
  const { metadata } = page;
  if (titles.has(metadata.title) || descriptions.has(metadata.description)) {
    throw new Error(`${page.source}: duplicate title or description`);
  }
  titles.add(metadata.title);
  descriptions.add(metadata.description);
  checkPage(page, siteConfig);
}
const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, location = ""]) => location,
);
if (sortedText(locations) !== sortedText(sitePages.map((page) => siteConfig.url + page.route))) {
  throw new Error("Sitemap must contain every canonical page exactly once");
}
if (
  !readFileSync(join(root, "robots.txt"), "utf8").includes(`Sitemap: ${siteConfig.url}/sitemap.xml`)
) {
  throw new Error("Robots must advertise the canonical sitemap");
}
checkFeed(sitePages, siteConfig);
console.log(`Validated SEO, JSON-LD, sitemap and PNG dimensions for ${sitePages.length} pages`);
