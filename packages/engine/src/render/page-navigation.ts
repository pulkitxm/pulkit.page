import { escapeHtml } from "@pulkit/shared/html";
import { ancestors, childCollections, relatedPages } from "../seo/routes.ts";
import type { ListedPage, PageMetadata, SiteContext, SiteLink } from "../types.ts";
import { linkClasses, safeUrl } from "./html.ts";

export function siteLinks(items: readonly SiteLink[], route: string, navigation: boolean): string {
  return items
    .map(
      (item) =>
        `<a class="${navigation ? "text-inherit no-underline aria-[current=page]:text-fg" : "text-inherit no-underline"}" href="${safeUrl(item.href)}"${navigation && item.href === route ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`,
    )
    .join(navigation ? "\n" : " · ");
}

export function breadcrumbs(route: string, pages: readonly ListedPage[]): string {
  const parents = ancestors(route, pages);
  return parents.length > 0
    ? `<nav class="mb-8 text-[0.8rem]" aria-label="Breadcrumb"><ol class="mt-0 mb-6 flex list-none flex-wrap gap-2 p-0 [&>li+li]:before:mr-2 [&>li+li]:before:opacity-50 [&>li+li]:before:content-['/'] [&_a]:text-inherit [&_a]:decoration-muted [&_a]:underline-offset-4 [&_a:hover]:decoration-current">${parents.map((page) => `<li><a href="${escapeHtml(page.route)}">${escapeHtml(page.route === "/" ? "Home" : page.metadata.title)}</a></li>`).join("")}<li aria-current="page">${escapeHtml(pages.find((page) => page.route === route)?.metadata.title ?? "Current page")}</li></ol></nav>`
    : "";
}

function navigationList(entries: readonly ListedPage[]): string {
  return entries
    .map(
      (page) =>
        `<li class="my-2"><a class="${linkClasses}" href="${escapeHtml(page.route)}">${escapeHtml(page.metadata.title)}</a></li>`,
    )
    .join("");
}

function navigationSection(label: string, heading: string, entries: readonly ListedPage[]): string {
  return `<nav class="mt-12 text-[0.9rem]" aria-label="${label}"><h2 class="mt-12 text-[1rem] font-semibold leading-tight tracking-tight">${heading}</h2><ul class="mt-0 mb-6">${navigationList(entries)}</ul></nav>`;
}

export function relatedNavigation(
  route: string,
  metadata: PageMetadata,
  pages: readonly ListedPage[],
  site: SiteContext,
): string {
  const related = relatedPages(route, metadata, pages, site);
  const collections = childCollections(route, pages);
  return `${collections.length > 0 && route !== "/" ? navigationSection("Collections", "Explore collections", collections) : ""}${related.length > 0 ? navigationSection("Related writing", "Related writing", related) : ""}`;
}
