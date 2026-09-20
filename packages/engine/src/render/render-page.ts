import { formatHtml } from "@pulkit/code/format-html";
import { createPageAssets } from "@pulkit/embeds";
import { escapeHtml } from "@pulkit/shared/html";
import type { GenerationCache } from "../lib/generation-cache.ts";
import { categoryOf, isArticle, markdownPath, pageTitle } from "../seo/routes.ts";
import { seoHead } from "../seo/seo-head.ts";
import { readPage } from "../site/read-page.ts";
import type { Layouts, ListedPage, PageMetadata, Site, SiteContext } from "../types.ts";
import { linkClasses, longDate, safeUrl } from "./html.ts";
import { analyticsScript, applyLayout, loadLayouts, themeScript } from "./layouts.ts";
import { experiencePeriod } from "./listings.ts";
import { createMarkdown } from "./markdown-renderer.ts";
import { breadcrumbs, relatedNavigation, siteLinks } from "./page-navigation.ts";

interface RenderOptions {
  layouts?: Layouts;
  site?: SiteContext;
  pages?: readonly ListedPage[];
  route?: string;
  cache?: GenerationCache;
}

function hasOrigin(site: SiteContext): site is Site {
  return Boolean(site.url);
}

function readingMinutes(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

function validateDate(metadata: PageMetadata): void {
  if (
    metadata.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date) ||
      Number.isNaN(Date.parse(metadata.date)) ||
      new Date(metadata.date).toISOString().slice(0, 10) !== metadata.date)
  ) {
    throw new Error("date must be a valid YYYY-MM-DD string");
  }
}

function articleDetail(
  metadata: PageMetadata,
  body: string,
  category: ListedPage | undefined,
): string {
  return [
    metadata.date
      ? `<time datetime="${escapeHtml(metadata.date)}">${longDate(metadata.date)}</time>`
      : "",
    `${readingMinutes(body)} min read`,
    category
      ? `<a class="${linkClasses}" href="${safeUrl(category.route)}">${escapeHtml(category.metadata.title)}</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function dateLine(metadata: PageMetadata, detail: string): string {
  if (!(detail || metadata.role)) {
    return "";
  }
  const period = metadata.icon ? experiencePeriod(metadata) : escapeHtml(metadata.period ?? "");
  return `<p class="mt-0 mb-6 text-sm text-muted">${[escapeHtml(metadata.role ?? ""), period, detail].filter(Boolean).join(" · ")}</p>`;
}

function headExtras(
  route: string,
  metadata: PageMetadata,
  site: SiteContext,
  pages: readonly ListedPage[],
): string {
  const seo = hasOrigin(site) ? seoHead(route, metadata, site, pages) : "";
  const feed = site.articles
    ? `<link rel="alternate" type="application/atom+xml" title="${escapeHtml(site.brand ?? "Feed")}" href="/feed.xml">`
    : "";
  return seo + feed;
}

export async function renderPage(
  source: string,
  { layouts = loadLayouts(), site = {}, pages = [], route = "/", cache }: RenderOptions = {},
): Promise<string> {
  const { metadata, body } = readPage(source);
  const article = isArticle(route, pages, site);
  const layout = metadata.layout ?? (article ? "article" : "simple");
  const assets = createPageAssets();
  const markdown = createMarkdown({ assets, cache, pages, route, site });
  validateDate(metadata);
  const plainDate =
    metadata.date && !metadata.period
      ? `<time datetime="${metadata.date}">${escapeHtml(metadata.date)}</time>`
      : "";
  const detail = article ? articleDetail(metadata, body, categoryOf(route, pages)) : plainDate;
  const content = await markdown.parse(body);
  const demoAssets = body.includes(":::demo ")
    ? '<link rel="stylesheet" href="/assets/demos/document.css"><script type="module" src="/assets/demos/index.js"></script>'
    : "";
  return formatHtml(
    applyLayout(layouts, layout, {
      title: escapeHtml(pageTitle(metadata, site, route)),
      themeScript: themeScript(),
      analyticsScript: analyticsScript(),
      seo: `${headExtras(route, metadata, site, pages)}${assets.tags()}${demoAssets}`,
      breadcrumbs: breadcrumbs(route, pages),
      related: relatedNavigation(route, metadata, pages, site),
      description: escapeHtml(metadata.description ?? site.description ?? metadata.title),
      brand: site.wordmark ?? escapeHtml(site.brand ?? "Pulkit"),
      author: escapeHtml(site.author ?? ""),
      authorUrl: site.authorUrl ? safeUrl(site.authorUrl) : "/",
      navigation: siteLinks(site.navigation ?? [], route, true),
      social: siteLinks(site.social ?? [], route, false),
      copyright: escapeHtml(site.copyright ?? ""),
      markdown: escapeHtml(markdownPath(route)),
      heading: escapeHtml(metadata.title),
      date: dateLine(metadata, detail),
      content,
    }),
  );
}
