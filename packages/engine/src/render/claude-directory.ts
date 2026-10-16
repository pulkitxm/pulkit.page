import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { escapeHtml } from "@pulkit/shared/html";
import { faSvg, lucideSvg } from "@pulkit/shared/icons";
import { Bug, MonitorPlay, Search, Star, X } from "lucide";
import type { DirectoryProject, SiteContext } from "../types.ts";
import {
  directoryCard,
  directoryIssue,
  mediaOrigin,
  unavailableDemo,
} from "./claude-directory-card.ts";
import type { PageAssets } from "./render-context.ts";

export const directoryDirective =
  /^:::claude-directory(?: (?:page=([1-9][0-9]*)|project=([\w.-]+)))?[ \t]*(?:\n|$)/;

export const directoryLine =
  /^:::claude-directory(?: (?:page=([1-9][0-9]*)|project=([\w.-]+)))?[ \t]*$/gm;

const pageSize = 24;
export const directoryScript = "/assets/embeds/claude-directory.js";
const repository = "https://github.com/pulkitxm/claude-directory";
const tagline =
  "UI experiments built with Claude. Watch the demos, copy the prompts, browse the code.";
const groupOrder = [
  "hero-sections",
  "landing-pages",
  "animations-loaders",
  "3d-games",
  "portfolios",
  "components-ui",
  "ui-design",
];
const providerLabels: Readonly<Record<string, string>> = {
  aceternity: "Aceternity",
  nextjstemplates: "Next.js Templates",
  tailwindcss: "Tailwind CSS",
};

const pill =
  "inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 font-medium text-fg/80 text-md no-underline shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] transition-colors hover:border-fg/40 hover:text-fg";

const pageLink =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-[6px] border border-line px-3 text-md text-inherit no-underline transition-colors hover:bg-surface aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg max-sm:min-w-8 max-sm:px-2";

const pageGap = "px-1 text-muted max-sm:px-0";

const filterItem =
  "shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-line bg-transparent px-3 py-1.5 text-md text-muted [font:inherit] transition-colors hover:text-fg aria-pressed:border-fg aria-pressed:bg-fg aria-pressed:text-bg min-[64rem]:flex min-[64rem]:w-full min-[64rem]:items-center min-[64rem]:justify-between min-[64rem]:gap-2 min-[64rem]:rounded-[6px] min-[64rem]:border-0 min-[64rem]:py-2 min-[64rem]:text-left min-[64rem]:hover:bg-surface min-[64rem]:aria-pressed:hover:bg-fg";

export function directoryFor(site: SiteContext): DirectoryProject[] {
  if (!site.directory) {
    throw new Error("The Claude Directory was not loaded");
  }
  return site.directory.projects;
}

export function directoryStars(site: SiteContext): number {
  return site.directory?.stars ?? 0;
}

export function directoryPageCount(projects: readonly DirectoryProject[]): number {
  return Math.max(1, Math.ceil(projects.length / pageSize));
}

export function directoryPageRoute(base: string, page: number): string {
  return page === 1 ? base : `${base}${page}/`;
}

export function directoryProjectRoute(base: string, project: DirectoryProject): string {
  return `${base}${project.name}/`;
}

export function directoryIndexPath(base: string): string {
  return `${base}projects.json`;
}

export function directoryPage(
  projects: readonly DirectoryProject[],
  page: number,
): DirectoryProject[] {
  if (page > directoryPageCount(projects)) {
    throw new Error(`The Claude Directory has no page ${page}`);
  }
  return projects.slice((page - 1) * pageSize, page * pageSize);
}

export function directoryBase(route: string, page: number): string {
  return page === 1 ? route : route.replace(/[0-9]+\/$/, "");
}

function humanize(value: string): string {
  const spaced = value.replace(/[-_]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface FilterItem {
  filter: string;
  label: string;
  count: number;
  sub: boolean;
}

function rank(group: string): number {
  const index = groupOrder.indexOf(group);
  return index === -1 ? groupOrder.length : index;
}

function filterItems(projects: readonly DirectoryProject[]): FilterItem[] {
  const groups = Map.groupBy(projects, (project) => project.group);
  const ordered = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const premium = projects.filter((project) => project.provider);
  const providers = Map.groupBy(premium, (project) => project.provider);
  return [
    { filter: "all", label: "All", count: projects.length, sub: false },
    ...ordered.flatMap((group): FilterItem[] => {
      const members = groups.get(group) ?? [];
      const item = {
        filter: `category:${group}`,
        label: members[0]?.category ?? humanize(group),
        count: members.length,
        sub: false,
      };
      if (group !== "templates" || providers.size === 0) {
        return [item];
      }
      return [
        item,
        { filter: "premium", label: "Premium only", count: premium.length, sub: true },
        ...[...providers.keys()]
          .sort((a, b) => a.localeCompare(b))
          .map((provider) => ({
            filter: `provider:${provider}`,
            label: providerLabels[provider] ?? humanize(provider),
            count: providers.get(provider)?.length ?? 0,
            sub: true,
          })),
      ];
    }),
  ];
}

function header(stars: number): string {
  const count = stars > 0 ? String(stars) : "";
  return `<div class="relative mb-6 py-3 sm:mb-2 sm:py-4"><div class="flex items-center justify-between gap-3 sm:gap-4"><h1 class="m-0 text-[30px]/[36px] font-bold text-fg sm:text-[36px]/[40px] min-[48rem]:text-[48px]/[1]" data-title>Claude Directory</h1><div class="flex shrink-0 items-center gap-2 sm:gap-3"><a class="${pill}" href="${escapeHtml(directoryIssue())}" target="_blank" rel="noopener noreferrer" aria-label="Report an issue on GitHub">${lucideSvg(Bug, "size-4")}<span class="hidden sm:inline">Report an issue</span></a><a class="group ${pill}" href="${repository}" target="_blank" rel="noopener noreferrer" aria-label="Star pulkitxm/claude-directory on GitHub" data-github-stars data-stars="${stars}">${faSvg(faGithub, "size-4 text-fg/70 transition-colors group-hover:text-fg")}<span class="tabular-nums" data-stars-count>${count}</span><span class="relative inline-flex" data-stars-burst>${lucideSvg(Star, "size-4 fill-[#facc15] stroke-[#facc15]")}</span></a></div></div><p class="mt-2 mb-0 text-base text-fg/70 sm:text-[18px]">${tagline}</p></div>`;
}

function filterButtons(projects: readonly DirectoryProject[]): string {
  return filterItems(projects)
    .map(
      (item) =>
        `<button class="${filterItem} ${item.sub ? "min-[64rem]:pr-3 min-[64rem]:pl-7" : "min-[64rem]:px-3"}" type="button" aria-pressed="${item.filter === "all"}" data-filter="${escapeHtml(item.filter)}"><span>${escapeHtml(item.label)}</span><span class="hidden text-xs text-muted/70 tabular-nums min-[64rem]:inline">${item.count}</span></button>`,
    )
    .join("");
}

function sidebar(projects: readonly DirectoryProject[]): string {
  const search = `<div class="relative min-w-0 flex-1" role="search">${lucideSvg(Search, "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted")}<label class="sr-only" for="directory-query">Search projects</label><input class="flex h-11 w-full min-w-0 rounded-[6px] border border-line bg-transparent px-9 py-2 text-base text-inherit shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] outline-none [font:inherit] placeholder:text-muted min-[48rem]:text-md" id="directory-query" type="text" placeholder="Search projects..." autocomplete="off" spellcheck="false" data-directory-query><button class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer leading-none border-0 bg-transparent p-0 text-muted transition-colors hover:text-fg" type="button" aria-label="Clear search" hidden data-directory-clear>${lucideSvg(X, "size-4")}</button></div>`;
  const preview = `<button class="group/toggle mt-3 inline-flex w-full cursor-pointer items-center justify-between gap-2 rounded-[8px] border border-line bg-transparent px-3 py-2 text-md text-muted [font:inherit] transition-colors hover:text-fg aria-pressed:border-fg/20 aria-pressed:bg-fg aria-pressed:text-bg" type="button" aria-pressed="false" data-directory-preview><span class="inline-flex items-center gap-2">${lucideSvg(MonitorPlay, "size-4")}Live preview only</span><span class="relative h-4 w-7 shrink-0 rounded-full bg-muted/25 transition-colors group-aria-pressed/toggle:bg-bg/30" aria-hidden="true"><span class="absolute top-0.5 left-0.5 size-3 rounded-full bg-muted transition-transform group-aria-pressed/toggle:translate-x-3 group-aria-pressed/toggle:bg-bg"></span></span></button>`;
  const categories = `<nav class="mt-4 min-[64rem]:flex min-[64rem]:min-h-0 min-[64rem]:flex-1 min-[64rem]:flex-col" aria-label="Filter by category"><p class="m-0 hidden shrink-0 px-1 pb-2 text-[11px] font-medium tracking-[0.05em] text-muted uppercase min-[64rem]:block">Categories</p><div class="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] min-[64rem]:flex-col min-[64rem]:gap-0.5 min-[64rem]:overflow-x-visible min-[64rem]:overflow-y-auto min-[64rem]:pb-0 [&::-webkit-scrollbar]:hidden">${filterButtons(projects)}</div></nav>`;
  return `<aside class="min-[64rem]:sticky min-[64rem]:top-6 min-[64rem]:flex min-[64rem]:max-h-[calc(100vh-3rem)] min-[64rem]:w-60 min-[64rem]:shrink-0 min-[64rem]:flex-col">${search}${preview}${categories}</aside>`;
}

function pageNumbers(current: number, count: number): (number | undefined)[] {
  const shown = [
    ...new Set([1, current - 1, current, current + 1, count].filter((n) => n >= 1 && n <= count)),
  ].sort((a, b) => a - b);
  return shown.flatMap((page, index) =>
    index > 0 && page - (shown[index - 1] ?? page) > 1 ? [undefined, page] : [page],
  );
}

function pagination(base: string, current: number, count: number): string {
  if (count === 1) {
    return "";
  }
  const link = (page: number, label: string, currentPage = false): string =>
    `<a class="${pageLink}" href="${escapeHtml(directoryPageRoute(base, page))}"${currentPage ? ' aria-current="page"' : ""}>${label}</a>`;
  const numbers = pageNumbers(current, count)
    .map((page) =>
      page === undefined
        ? `<span class="${pageGap}" aria-hidden="true">…</span>`
        : link(page, String(page), page === current),
    )
    .join("");
  return `<nav class="mt-10 flex flex-wrap items-center justify-center gap-1.5 text-md tabular-nums max-sm:gap-1" aria-label="Directory pages">${current > 1 ? link(current - 1, "Prev") : ""}${numbers}${current < count ? link(current + 1, "Next") : ""}</nav>`;
}

function templates(projects: readonly DirectoryProject[], base: string): string {
  const sample = projects.find((project) => project.published);
  return [
    sample
      ? `<template data-directory-card>${directoryCard({ ...sample, blur: "" }, base)}</template>`
      : "",
    `<template data-directory-unavailable>${unavailableDemo()}</template>`,
    `<template data-page-link><a class="${pageLink}" href="${escapeHtml(base)}">1</a></template>`,
    `<template data-page-gap><span class="${pageGap}" aria-hidden="true">…</span></template>`,
    `<template data-page-nav><nav class="mt-10 flex flex-wrap items-center justify-center gap-1.5 text-md tabular-nums max-sm:gap-1" aria-label="Result pages"></nav></template>`,
  ].join("");
}

export function renderDirectory(
  projects: readonly DirectoryProject[],
  stars: number,
  page: number,
  route: string,
  assets: PageAssets,
): string {
  assets.script(directoryScript);
  const base = directoryBase(route, page);
  const cards = directoryPage(projects, page)
    .map((project) => directoryCard(project, directoryProjectRoute(base, project)))
    .join("");
  const results = `<div class="min-w-0 flex-1"><p class="mt-0 mb-5 text-md text-muted" aria-live="polite" data-directory-status><span class="font-medium text-fg">${projects.length}</span> projects</p><section class="relative"><div class="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 min-[80rem]:grid-cols-3" data-directory-list>${cards}</div><div class="rounded-[12px] border border-dashed border-line/60 py-20 text-center" hidden data-directory-empty><p class="m-0 text-md font-medium text-fg">No projects match your filters</p><p class="mt-1 mb-0 text-md text-muted">Try a different search or category.</p></div></section><div data-directory-pages>${pagination(base, page, directoryPageCount(projects))}</div><div data-directory-result-pages></div></div>`;
  return `<div class="w-full pb-8 sm:pb-12">${header(stars)}<div class="mt-8 flex flex-col gap-6 sm:mt-12 min-[64rem]:flex-row min-[64rem]:items-start min-[64rem]:gap-10" data-directory data-index="${escapeHtml(directoryIndexPath(base))}" data-base="${escapeHtml(base)}" data-media="${mediaOrigin}" data-page="${page}">${sidebar(projects)}${results}${templates(projects, base)}</div></div>`;
}
