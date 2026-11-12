import { escapeHtml } from "@pulkit/shared/html";
import { lucideSvg } from "@pulkit/shared/icons";
import { ArrowRight, Code2, ExternalLink } from "lucide";
import type { DirectoryProject } from "../types.ts";
import { safeUrl } from "./html.ts";

const repository = "https://github.com/pulkitxm/claude-directory";
const cardShadow = "shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]";
export const pill =
  "inline-flex w-fit items-center rounded-full border border-line/60 bg-surface/40 font-medium text-muted";
const action =
  "-my-1.5 inline-flex min-h-9 items-center gap-1 py-1.5 text-md text-muted no-underline transition-colors hover:text-fg";

export function directorySource(project: DirectoryProject): string {
  return project.source;
}

export function directoryIssue(project?: DirectoryProject): string {
  return project
    ? `${repository}/issues/new?title=${encodeURIComponent(`Issue with ${project.title}`)}`
    : `${repository}/issues/new`;
}

export function directoryRecording(project: DirectoryProject): string {
  if (!project.thumbnail) {
    return '<div class="absolute inset-0 grid place-items-center bg-surface text-sm text-muted" data-preview-placeholder>Preview preparing</div>';
  }
  const poster = `<img class="absolute inset-0 size-full object-cover" src="${safeUrl(project.thumbnail)}" alt="" width="1280" height="800" loading="lazy" decoding="async" data-preview-poster>`;
  const video = project.video
    ? '<video class="pointer-events-none absolute inset-0 m-0 size-full object-cover opacity-0 transition-opacity duration-500 motion-reduce:transition-none" loop muted playsinline preload="none" aria-hidden="true" data-card-preview-video></video>'
    : "";
  return `${poster}${video}`;
}

export function directoryCard(project: DirectoryProject, href: string): string {
  return `<div class="[contain-intrinsic-size:auto_380px] [content-visibility:auto]" data-card><article class="group relative h-full overflow-hidden rounded-[12px] border border-line/60 bg-surface/40 text-fg ${cardShadow} transition-[border-color,box-shadow] duration-300 hover:border-fg/20 hover:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.1),0_2px_4px_-2px_rgb(0_0_0/0.1)]"><a class="block text-inherit no-underline" href="${escapeHtml(href)}" data-card-link data-card-video="${project.video ? safeUrl(project.video) : ""}"><div class="relative aspect-[1280/800] w-full overflow-hidden border-b border-line/50 bg-surface/30" data-card-media>${directoryRecording(project)}</div><div class="space-y-3 px-5 pt-5"><div class="flex items-center justify-between gap-4"><h2 class="m-0 truncate text-base leading-none font-semibold tracking-tight" data-card-title data-title>${escapeHtml(project.title)}</h2><div class="flex size-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-surface text-muted transition-[border-color,background-color,color] group-hover:border-line group-hover:bg-bg group-hover:text-fg">${lucideSvg(ArrowRight, "size-4 -rotate-45 transition-transform duration-300 group-hover:rotate-0")}</div></div><span class="${pill} px-2 py-0.5 text-[11px]" data-card-category>${escapeHtml(project.category)}</span></div></a><div class="relative z-20 flex items-center gap-4 px-5 pt-3 pb-5"><a class="${action}" href="${safeUrl(project.preview)}" target="_blank" rel="noopener noreferrer" data-card-preview>${lucideSvg(ExternalLink, "size-3.5")}Preview</a><a class="${action}" href="${safeUrl(project.source)}" target="_blank" rel="noopener noreferrer" data-card-source>${lucideSvg(Code2, "size-3.5")}Source</a></div></article></div>`;
}
