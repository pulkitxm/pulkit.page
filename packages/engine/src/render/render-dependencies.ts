import { categoryOf } from "../seo/routes.ts";
import { seoHead } from "../seo/seo-head.ts";
import type { ListedPage, PageRecord, Site } from "../types.ts";
import { collectionItems, listDirective, listingLimit } from "./listings.ts";
import { breadcrumbs, relatedNavigation } from "./page-navigation.ts";

interface RenderDependencies {
  seo: string;
  breadcrumbs: string;
  related: string;
  category: string | undefined;
  listings: (string | undefined)[][][];
}

export function renderDependencies(
  page: PageRecord,
  pages: readonly ListedPage[],
  site: Site,
): RenderDependencies {
  return {
    seo: seoHead(page.route, page.metadata, site, pages),
    breadcrumbs: breadcrumbs(page.route, pages),
    related: relatedNavigation(page.route, page.metadata, pages, site),
    category: categoryOf(page.route, pages)?.metadata.title,
    listings: [...page.body.matchAll(new RegExp(listDirective, "gm"))].map(
      ([, collection = "", limit]) =>
        collectionItems(pages, page.route, collection, listingLimit(limit), site).map((entry) => [
          entry.route,
          entry.metadata.title,
          entry.metadata.period,
          entry.metadata.date,
          entry.metadata.endDate,
          entry.metadata.icon,
          entry.metadata.darkIcon,
          entry.metadata.secondaryIcon,
          entry.metadata.role,
        ]),
    ),
  };
}
