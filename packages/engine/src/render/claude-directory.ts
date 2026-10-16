import { escapeHtml } from "@pulkit/shared/html";
import type { DirectoryProject, SiteContext } from "../types.ts";
import { safeUrl } from "./html.ts";
import type { PageAssets } from "./render-context.ts";

export const directoryDirective = /^:::claude-directory(?: page=([1-9][0-9]*))?[ \t]*(?:\n|$)/;

export const directoryLine = /^:::claude-directory(?: page=([1-9][0-9]*))?[ \t]*$/gm;

const mediaOrigin = "https://claude-directory.pulkitxm.com/";
const sourceOrigin = "https://github.com/pulkitxm/claude-directory/tree/main/";
const pageSize = 24;

const gapClasses = "px-1 text-muted max-sm:px-0";

const pageLink =
  "min-w-9 rounded-md border border-line px-2.5 py-1.5 text-center max-sm:min-w-8 max-sm:px-2 text-inherit no-underline hover:bg-surface aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg";

export function directoryFor(site: SiteContext): DirectoryProject[] {
  if (!site.directory) {
    throw new Error("The Claude Directory was not loaded");
  }
  return site.directory;
}

export function directoryPageCount(projects: readonly DirectoryProject[]): number {
  return Math.max(1, Math.ceil(projects.length / pageSize));
}

export function directoryPageRoute(base: string, page: number): string {
  return page === 1 ? base : `${base}${page}/`;
}

export function directoryIndexPath(base: string): string {
  return `${base}projects.json`;
}

export function directorySource(project: DirectoryProject): string {
  return sourceOrigin + project.path;
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

function card(project: DirectoryProject): string {
  const image = project.poster
    ? `<img class="block size-full object-cover" src="${safeUrl(`${mediaOrigin}${project.path}/poster.jpg`)}" alt="" width="1280" height="800" loading="lazy" decoding="async" data-card-image>`
    : "No preview";
  return `<li class="min-w-0"><a class="group grid gap-2.5 text-inherit no-underline" href="${safeUrl(directorySource(project))}" rel="noopener" data-card-link><span class="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-md border border-line bg-surface text-xs text-muted" data-card-frame>${image}</span><span class="flex items-baseline justify-between gap-3"><span class="truncate font-medium underline-offset-4 group-hover:underline" data-card-name>${escapeHtml(project.name)}</span><span class="shrink-0 text-2xs text-muted" data-card-category>${escapeHtml(project.category)}</span></span></a><p class="mt-1.5 mb-0 line-clamp-3 text-sm leading-normal text-muted" data-card-summary>${escapeHtml(project.summary)}</p></li>`;
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
  const step = (page: number, label: string): string =>
    page >= 1 && page <= count
      ? `<a class="${pageLink}" href="${escapeHtml(directoryPageRoute(base, page))}">${label}</a>`
      : "";
  const numbers = pageNumbers(current, count)
    .map((page) =>
      page === undefined
        ? `<span class="${gapClasses}" aria-hidden="true">…</span>`
        : `<a class="${pageLink}" href="${escapeHtml(directoryPageRoute(base, page))}"${page === current ? ' aria-current="page"' : ""}>${page}</a>`,
    )
    .join("");
  return `<nav class="mt-10 flex flex-wrap items-center justify-center gap-1.5 text-sm tabular-nums max-sm:gap-1" aria-label="Directory pages">${step(current - 1, "Prev")}${numbers}${step(current + 1, "Next")}</nav>`;
}

export function renderDirectory(
  projects: readonly DirectoryProject[],
  page: number,
  route: string,
  assets: PageAssets,
): string {
  assets.script("/assets/embeds/claude-directory.js");
  const base = directoryBase(route, page);
  const count = directoryPageCount(projects);
  const shown = directoryPage(projects, page);
  const first = (page - 1) * pageSize + 1;
  const status = `Showing ${first} to ${first + shown.length - 1} of ${projects.length} projects`;
  const placeholder = projects[0];
  const template = placeholder
    ? `<template data-directory-card>${card({ ...placeholder, poster: true })}</template>`
    : "";
  return `<div class="mt-8" data-directory data-index="${escapeHtml(directoryIndexPath(base))}" data-media="${mediaOrigin}" data-source="${sourceOrigin}"><div class="mb-4" role="search" hidden data-directory-search><label class="sr-only" for="directory-query">Search all ${projects.length} projects</label><input class="box-border w-full rounded-md border border-line bg-transparent px-3.5 py-2.5 text-inherit [font:inherit] placeholder:text-muted" id="directory-query" name="q" type="search" placeholder="Search all ${projects.length} projects" autocomplete="off" spellcheck="false"></div><p class="mt-0 mb-6 text-sm text-muted" aria-live="polite" data-directory-status>${status}</p><ul class="m-0 grid list-none gap-x-6 gap-y-8 p-0 sm:grid-cols-2" data-directory-list>${shown.map(card).join("")}</ul><div class="mt-8 text-center" hidden data-directory-more><button class="cursor-pointer rounded-md border border-line bg-transparent px-4 py-2 text-sm text-inherit [font:inherit] hover:bg-surface" type="button">Show more</button></div><div data-directory-pages>${pagination(base, page, count)}</div>${template}</div>`;
}
