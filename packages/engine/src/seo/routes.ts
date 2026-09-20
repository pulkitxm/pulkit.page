import type { ListedPage, PageMetadata, SiteContext } from "../types.ts";

export const notFoundRoute = "/404/";

export const notFoundFile = "404.html";

export function isNotFound(route: string): boolean {
  return route === notFoundRoute;
}

export function markdownPath(route: string): string {
  return route === "/" ? "/index.md" : `${route.slice(0, -1)}.md`;
}

export function imagePath(route: string): string {
  return `/og/${route === "/" ? "home" : route.slice(1, -1)}/card.png`;
}

export function parentRoute(route: string): string {
  return route.slice(0, route.lastIndexOf("/", route.length - 2) + 1);
}

export function isArticle(route: string, pages: readonly ListedPage[], site: SiteContext): boolean {
  return (
    typeof site.articles === "string" &&
    route !== "/" &&
    !isNotFound(route) &&
    route.startsWith(site.articles) &&
    !pages.find((page) => page.route === route)?.index
  );
}

export function articles<T extends ListedPage>(pages: readonly T[], site: SiteContext): T[] {
  return pages.filter((page) => isArticle(page.route, pages, site));
}

export function categoryOf<T extends ListedPage>(
  route: string,
  pages: readonly T[],
): T | undefined {
  const parent = parentRoute(route);
  return parent === "/" ? undefined : pages.find((page) => page.index && page.route === parent);
}

export function newestFirstByTitle(a: ListedPage, b: ListedPage): number {
  return (
    (b.metadata.date ?? "").localeCompare(a.metadata.date ?? "") ||
    a.metadata.title.localeCompare(b.metadata.title)
  );
}

export function newestFirstByRoute(a: ListedPage, b: ListedPage): number {
  return (
    (b.metadata.date ?? "").localeCompare(a.metadata.date ?? "") || a.route.localeCompare(b.route)
  );
}

export function pageTitle(metadata: PageMetadata, site: SiteContext, route: string): string {
  if (route === "/") {
    return site.brand ?? "Pulkit";
  }
  const branded = `${metadata.title} | ${site.brand ?? "Pulkit"}`;
  return branded.length > 70 ? metadata.title : branded;
}

export function ancestors<T extends ListedPage>(route: string, pages: readonly T[]): T[] {
  return pages
    .filter(
      (page) =>
        page.route !== route &&
        (page.route === "/" || (page.index && route.startsWith(page.route))),
    )
    .sort((a, b) => a.route.length - b.route.length);
}

export function childCollections<T extends ListedPage>(route: string, pages: readonly T[]): T[] {
  return pages.filter(
    (page) =>
      page.index &&
      page.route !== route &&
      page.route.startsWith(route) &&
      !pages.some(
        (parent) =>
          parent.index &&
          parent.route !== route &&
          parent.route !== page.route &&
          page.route.startsWith(parent.route) &&
          parent.route.startsWith(route),
      ),
  );
}

export function relatedPages<T extends ListedPage>(
  route: string,
  metadata: PageMetadata,
  pages: readonly T[],
  site: SiteContext,
): T[] {
  if (!isArticle(route, pages, site)) {
    return [];
  }
  const tags = new Set((metadata.tags ?? []).map((tag) => tag.toLowerCase()));
  const parent = parentRoute(route);
  return articles(pages, site)
    .filter((page) => page.route !== route)
    .map((page) => ({
      page,
      score:
        (page.metadata.tags ?? []).filter((tag) => tags.has(tag.toLowerCase())).length +
        (parent !== site.articles && page.route.startsWith(parent) ? 3 : 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.page.route.localeCompare(b.page.route))
    .slice(0, 3)
    .map((item) => item.page);
}
