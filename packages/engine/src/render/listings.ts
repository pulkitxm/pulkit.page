import { escapeHtml } from "@pulkit/shared/html";
import { articles, newestFirstByTitle, parentRoute } from "../seo/routes.ts";
import type { ListedPage, PageMetadata, SiteContext } from "../types.ts";
import { galleryImage } from "./gallery-image.ts";
import { safeUrl } from "./html.ts";

export const listDirective =
  /^:::list ((?:[a-z0-9-]+:all)|[a-z0-9/-]+)(?: limit=([1-9][0-9]*))?( by-year)?( grid)?\s*(?:\n|$)/;

export interface Listing {
  collection: string;
  limit: number;
  grouped: boolean;
  grid: boolean;
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

const stackedIcon =
  "rounded-xl border-2 border-bg bg-bg ring-1 ring-line transition-transform duration-300 ease-out";

function experienceIcon(icon: string | undefined, className: string): string {
  return `<img class="${className} size-9 object-contain" src="${safeUrl(icon)}" alt="" width="36" height="36" loading="lazy">`;
}

function experienceEntry(page: ListedPage): string {
  const { metadata } = page;
  const front = metadata.secondaryIcon ? `m-0 ${stackedIcon} group-hover:-translate-x-0.5` : "m-0";
  const icons = [
    metadata.darkIcon
      ? experienceIcon(metadata.icon, `${front} dark:hidden`) +
        experienceIcon(metadata.darkIcon, `${front} hidden dark:block`)
      : experienceIcon(metadata.icon, front),
    metadata.secondaryIcon &&
      experienceIcon(
        metadata.secondaryIcon,
        `m-0 -ml-3 translate-y-2.5 ${stackedIcon} group-hover:translate-x-1`,
      ),
  ]
    .filter(Boolean)
    .join("");
  return `<li class="border-b border-line"><a class="group grid grid-cols-[48px_minmax(0,1fr)_auto] items-center justify-between gap-4 py-5 leading-normal text-inherit no-underline underline-offset-4 max-sm:grid-cols-[48px_minmax(0,1fr)] max-sm:gap-3" href="${safeUrl(page.route)}"><span class="flex w-12 items-center max-sm:row-span-2">${icons}</span><span class="grid gap-0.75"><span class="group-hover:underline" data-title>${escapeHtml(metadata.title)}</span><span class="text-xs text-muted">${escapeHtml(metadata.role)}</span></span><span class="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums max-sm:col-start-2 max-sm:text-2xs">${experiencePeriod(metadata)}</span></a></li>`;
}

function gridEntry(page: ListedPage, grouped: boolean, recent: boolean, priority: boolean): string {
  const { metadata } = page;
  if (!metadata.cover) {
    throw new Error(`Grid list entry needs a cover image: ${page.route}`);
  }
  const description = metadata.description
    ? `<span class="mt-1 line-clamp-2 text-xs leading-normal text-muted">${escapeHtml(metadata.description)}</span>`
    : "";
  return `<li class="m-0"><a class="group flex flex-col text-inherit no-underline underline-offset-4" href="${safeUrl(page.route)}"><span class="relative block h-64 overflow-hidden rounded-lg bg-line">${galleryImage(metadata.cover, "", priority)}</span><span class="mt-3 flex items-baseline justify-between gap-3 leading-normal"><span class="group-hover:underline" data-title>${escapeHtml(metadata.title)}</span><span class="shrink-0 text-xs text-muted max-sm:text-2xs">${listingDate(metadata, grouped, recent)}</span></span>${description}</a></li>`;
}

function gridEntries(
  entries: readonly ListedPage[],
  grouped: boolean,
  recent: boolean,
  leading = false,
): string {
  return `<ul class="mt-0 mb-6 grid list-none grid-cols-2 gap-x-4 gap-y-8 p-0 max-sm:grid-cols-1" data-event-grid>${entries
    .map((page, index) => gridEntry(page, grouped, recent, leading && !recent && index < 2))
    .join("")}</ul>`;
}

function listEntries(
  entries: readonly ListedPage[],
  grouped: boolean,
  recent: boolean,
  _leading = false,
): string {
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
  const entries = listing.grid ? gridEntries : listEntries;
  if (!grouped) {
    return entries(items, grouped, recent, true);
  }
  const years = Map.groupBy(items, (page) => (page.metadata.date ?? "").slice(0, 4));
  return [...years]
    .map(
      ([year, yearEntries], index) =>
        `<h2 class="mt-10 mb-2 flex items-center gap-4 text-md font-medium leading-tight tracking-normal text-muted after:h-px after:flex-1 after:bg-line">${escapeHtml(year)}</h2>${entries(yearEntries, grouped, recent, index === 0)}`,
    )
    .join("");
}
