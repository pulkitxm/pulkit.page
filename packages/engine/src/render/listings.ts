import { escapeHtml } from "@pulkit/shared/html";
import { articles, newestFirstByTitle, parentRoute } from "../seo/routes.ts";
import type { ListedPage, PageMetadata, SiteContext } from "../types.ts";
import { safeUrl } from "./html.ts";

export const listDirective =
  /^:::list ((?:[a-z0-9-]+:all)|[a-z0-9/-]+)(?: limit=([1-9][0-9]*))?( by-year)?\s*(?:\n|$)/;

export interface Listing {
  collection: string;
  limit: number;
  grouped: boolean;
}

export function listingLimit(limit: string | undefined): number {
  return Number(limit) || Number.POSITIVE_INFINITY;
}

export function collectionItems(
  pages: readonly ListedPage[],
  route: string,
  collection: string,
  limit: number,
  site: SiteContext,
): ListedPage[] {
  const external = /^([a-z0-9-]+):all$/.exec(collection)?.[1];
  let entries: readonly ListedPage[];
  if (external) {
    const externalEntries = site.external?.[external];
    if (!externalEntries) {
      throw new Error(`Unknown site in list directive: ${external}`);
    }
    entries = externalEntries;
  } else if (collection === "all") {
    entries = articles(pages, site);
  } else {
    entries = pages.filter((page) => !page.index && parentRoute(page.route) === `/${collection}/`);
  }
  return entries
    .filter((page) => page.route !== route)
    .sort(newestFirstByTitle)
    .slice(0, limit);
}

function listingDate(metadata: PageMetadata, grouped: boolean, recent: boolean): string {
  if (metadata.period || !metadata.date) {
    return escapeHtml(metadata.period ?? "");
  }
  const thisYear = Number(metadata.date.slice(0, 4)) === new Date().getUTCFullYear();
  const month = new Intl.DateTimeFormat("en-US", {
    day: grouped || recent ? "numeric" : undefined,
    month: "short",
    year: grouped || (recent && thisYear) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(metadata.date));
  return `<time datetime="${escapeHtml(metadata.date)}">${month}</time>`;
}

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const exactFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function periodDate(value: string): string {
  return `<time class="cursor-help underline decoration-line decoration-dotted underline-offset-4" datetime="${escapeHtml(value)}" title="${exactFormat.format(new Date(value))}">${monthFormat.format(new Date(value))}</time>`;
}

export function experiencePeriod(metadata: PageMetadata): string {
  return `${periodDate(metadata.date ?? "")} – ${metadata.endDate ? periodDate(metadata.endDate) : "present"}`;
}

function experienceIcon(icon: string | undefined, className: string): string {
  return `<img class="${className} size-9 object-contain" src="${safeUrl(icon)}" alt="" width="36" height="36" loading="lazy">`;
}

function experienceEntry(page: ListedPage): string {
  const { metadata } = page;
  const icons = [
    metadata.darkIcon
      ? experienceIcon(metadata.icon, "m-0 dark:hidden") +
        experienceIcon(metadata.darkIcon, "m-0 hidden dark:block")
      : experienceIcon(metadata.icon, "m-0"),
    metadata.secondaryIcon && experienceIcon(metadata.secondaryIcon, "m-0 -ml-6 translate-y-2.5"),
  ]
    .filter(Boolean)
    .join("");
  return `<li class="border-b border-line"><a class="group grid grid-cols-[48px_minmax(0,1fr)_auto] items-center justify-between gap-4 py-5 leading-normal text-inherit no-underline underline-offset-4 max-sm:grid-cols-[48px_minmax(0,1fr)] max-sm:gap-3" href="${safeUrl(page.route)}"><span class="flex w-12 items-center max-sm:row-span-2">${icons}</span><span class="grid gap-0.75"><span class="group-hover:underline" data-title>${escapeHtml(metadata.title)}</span><span class="text-xs text-muted">${escapeHtml(metadata.role)}</span></span><span class="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums max-sm:col-start-2 max-sm:text-2xs">${experiencePeriod(metadata)}</span></a></li>`;
}

function listEntries(entries: readonly ListedPage[], grouped: boolean, recent: boolean): string {
  return `<ul class="mt-0 mb-6 list-none p-0">${entries
    .map((page) =>
      page.metadata.icon
        ? experienceEntry(page)
        : `<li class="border-b border-line"><a class="group flex items-baseline justify-between gap-5 py-3.75 leading-normal text-inherit no-underline underline-offset-4 max-sm:gap-3" href="${safeUrl(page.route)}"><span class="group-hover:underline" data-title>${escapeHtml(page.metadata.title)}</span><span class="shrink-0 text-xs text-muted max-sm:text-2xs">${listingDate(page.metadata, grouped, recent)}</span></a></li>`,
    )
    .join("")}</ul>`;
}

export function renderListing(items: readonly ListedPage[], listing: Listing): string {
  if (items.length === 0) {
    throw new Error(`Empty or unknown collection: ${listing.collection}`);
  }
  const { grouped } = listing;
  const recent = Number.isFinite(listing.limit);
  if (!grouped) {
    return listEntries(items, grouped, recent);
  }
  const years = Map.groupBy(items, (page) => (page.metadata.date ?? "").slice(0, 4));
  return [...years]
    .map(
      ([year, entries]) =>
        `<h2 class="mt-10 mb-2 flex items-center gap-4 text-md font-medium leading-tight tracking-normal text-muted after:h-px after:flex-1 after:bg-line">${escapeHtml(year)}</h2>${listEntries(entries, grouped, recent)}`,
    )
    .join("");
}
