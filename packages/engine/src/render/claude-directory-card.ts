import { escapeHtml } from "@pulkit/shared/html";
import { lucideSvg } from "@pulkit/shared/icons";
import { ArrowRight, Clapperboard, Copy, Download } from "lucide";
import type { DirectoryProject } from "../types.ts";
import { safeUrl } from "./html.ts";

const repository = "https://github.com/pulkitxm/claude-directory";
const rawOrigin = "https://raw.githubusercontent.com/pulkitxm/claude-directory/main/";
export const mediaOrigin = "https://claude-directory.pulkitxm.com/";

const cardShadow = "shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]";
export const pill =
  "inline-flex w-fit items-center rounded-full border border-line/60 bg-surface/40 font-medium text-muted";

const cardAction =
  "-my-1.5 inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-[6px] border-0 bg-transparent p-0 py-1.5 text-md text-muted no-underline [font:inherit] transition-colors hover:text-fg";

export function directorySource(project: DirectoryProject): string {
  return `${repository}/tree/main/${project.path}`;
}

export function directoryDemo(project: DirectoryProject): string {
  return `${mediaOrigin}${project.path}/demo.mp4`;
}

export function directoryPoster(project: DirectoryProject): string {
  return `${mediaOrigin}${project.path}/poster.jpg`;
}

export function directoryPrompt(project: DirectoryProject): string {
  return `${rawOrigin}${project.path}/prompt.md`;
}

export function directoryDownload(project: DirectoryProject): string {
  return `https://download-directory.github.io/?url=${encodeURIComponent(directorySource(project))}`;
}

export function directoryIssue(project?: DirectoryProject): string {
  const base = `${repository}/issues/new`;
  return project ? `${base}?title=${encodeURIComponent(`Issue with ${project.title}`)}` : base;
}

export function unavailableDemo(): string {
  return `<div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted" data-card-unavailable>${lucideSvg(Clapperboard, "size-6")}<span class="text-xs">Demo unavailable</span></div>`;
}

function media(project: DirectoryProject): string {
  if (!project.published) {
    return unavailableDemo();
  }
  const placeholder = project.blur
    ? `<img class="absolute inset-0 size-full scale-105 object-cover blur-[40px]" src="${escapeHtml(project.blur)}" alt="" aria-hidden="true" data-card-blur>`
    : `<img class="absolute inset-0 size-full object-cover" src="${safeUrl(directoryPoster(project))}" alt="" aria-hidden="true" loading="lazy" decoding="async" data-card-blur>`;
  return `${placeholder}<video class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500" loop muted playsinline preload="none" aria-hidden="true" data-card-video></video>`;
}

export function directoryCard(project: DirectoryProject, href: string): string {
  const demo = project.published ? ` data-demo="${safeUrl(directoryDemo(project))}"` : "";
  return `<div class="[contain-intrinsic-size:auto_380px] [content-visibility:auto]" data-card><article class="group relative h-full overflow-hidden rounded-[12px] border border-line/60 bg-surface/40 text-fg ${cardShadow} transition-[border-color,box-shadow] duration-300 hover:border-fg/20 hover:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.1),0_2px_4px_-2px_rgb(0_0_0/0.1)]"><a class="block text-inherit no-underline" href="${escapeHtml(href)}" data-card-link><div class="relative aspect-[1280/800] w-full overflow-hidden border-b border-line/50 bg-surface/30" data-card-media${demo}>${media(project)}</div><div class="space-y-3 px-5 pt-5"><div class="flex items-center justify-between gap-4"><h2 class="m-0 truncate text-base leading-none font-semibold tracking-tight" data-card-title data-title>${escapeHtml(project.title)}</h2><div class="flex size-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-surface text-muted transition-[border-color,background-color,color] group-hover:border-line group-hover:bg-bg group-hover:text-fg">${lucideSvg(ArrowRight, "size-4 -rotate-45 transition-transform duration-300 group-hover:rotate-0")}</div></div><span class="${pill} px-2 py-0.5 text-[11px]" data-card-category>${escapeHtml(project.category)}</span></div></a><div class="relative z-20 flex items-center gap-4 px-5 pt-3 pb-5"><button class="${cardAction}" type="button" aria-label="${escapeHtml(`Copy prompt for ${project.name}`)}" data-prompt-copy data-prompt="${safeUrl(directoryPrompt(project))}">${lucideSvg(Copy, "size-3.5")}<span data-copy-label>Copy prompt</span></button><a class="${cardAction}" href="${safeUrl(directoryDownload(project))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(`Download ${project.name}`)}" data-card-download>${lucideSvg(Download, "size-3.5")}Download</a></div></article></div>`;
}
