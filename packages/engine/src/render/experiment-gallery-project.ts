import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { escapeHtml } from "@pulkit/shared/html";
import { faSvg, lucideSvg } from "@pulkit/shared/icons";
import { ArrowLeft, ArrowRight, Bug, ExternalLink } from "lucide";
import type { DirectoryProject } from "../types.ts";
import { directoryBase, directoryProjectRoute } from "./experiment-gallery.ts";
import { directoryIssue, directoryRecording, pill } from "./experiment-gallery-card.ts";
import { safeUrl } from "./html.ts";

const button =
  "inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[6px] px-4 py-2 font-medium text-md no-underline [font:inherit] transition-[color,background-color,box-shadow]";
const outline = `${button} border border-line bg-bg text-fg shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:bg-surface`;
const ghost = `${button} border-0 bg-transparent text-fg hover:bg-surface`;
const primary = `${button} h-12 border-0 bg-fg text-base text-bg shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:bg-fg/90`;
const arrow =
  "inline-flex size-8 items-center justify-center rounded-[6px] text-fg no-underline transition-colors hover:bg-surface";
const pane = "rounded-[16px] border border-fg/10 bg-bg/80";

export function directoryProjectAt(
  projects: readonly DirectoryProject[],
  name: string,
): { project: DirectoryProject; index: number } {
  const index = projects.findIndex((entry) => entry.name === name);
  const project = projects[index];
  if (!project) {
    throw new Error(`The reviewed gallery has no project ${name}`);
  }
  return { project, index };
}

function preview(project: DirectoryProject): string {
  const frame =
    "aspect-[1280/800] w-full max-w-[56rem] overflow-hidden rounded-[12px] border border-[#000]/10 shadow-[0_40px_100px_-20px_rgb(0_0_0/0.85)] dark:border-[#fff]/10 min-[64rem]:w-[min(100cqw,160cqh)]";
  const content =
    project.video && project.thumbnail
      ? `<video class="m-0 block size-full bg-[#000] object-contain" controls playsinline preload="none" poster="${safeUrl(project.thumbnail)}" aria-label="${escapeHtml(project.title)} project recording" data-project-recording><source src="${safeUrl(project.video)}" type="video/mp4">Your browser does not support this recording. <a href="${safeUrl(project.preview)}">Open the current project preview</a>.</video>`
      : `<div class="relative aspect-[1280/800] w-full overflow-hidden">${directoryRecording(project)}</div>`;
  return `<div class="relative order-2 min-w-0 overflow-hidden rounded-[16px] border border-line/40 min-[64rem]:order-1 min-[64rem]:h-full min-[64rem]:min-h-0" data-project-panel="preview"><div class="relative flex items-center justify-center p-4 sm:p-8 min-[64rem]:absolute min-[64rem]:inset-0 min-[64rem]:p-14 min-[64rem]:[container-type:size]"><div class="${frame}" data-project-frame>${content}</div></div></div>`;
}

function sidebar(
  project: DirectoryProject,
  base: string,
  previous?: string,
  next?: string,
): string {
  const step = (href: string | undefined, label: string, icon: typeof ArrowLeft): string =>
    href
      ? `<a class="${arrow}" href="${escapeHtml(href)}" aria-label="${label}">${lucideSvg(icon, "size-4 opacity-70")}</a>`
      : "";
  return `<aside class="order-1 flex flex-col gap-5 ${pane} p-6 min-[64rem]:order-2 min-[64rem]:overflow-y-auto" aria-label="Project details" data-project-sidebar><div><h1 class="m-0 text-[24px]/[32px] font-bold tracking-tight text-fg sm:text-[30px]/[36px]" data-title>${escapeHtml(project.title)}</h1><p class="mt-2 mb-0 text-md text-fg/70">${escapeHtml(project.description)}</p></div><span class="${pill} px-2.5 py-0.5 text-xs">${escapeHtml(project.category)}</span><div class="flex flex-col gap-2.5"><a class="${primary}" href="${safeUrl(project.preview)}" target="_blank" rel="noopener noreferrer">${lucideSvg(ExternalLink, "size-4")}Open current preview</a><a class="${outline}" href="${safeUrl(project.source)}" target="_blank" rel="noopener noreferrer">${faSvg(faGithub, "size-4")}Source folder</a></div><nav class="flex flex-col gap-2.5 border-t border-line/60 pt-5 text-xs text-muted" aria-label="Project resources"><a class="text-inherit underline underline-offset-4" href="${safeUrl(`/assets/project-previews/${project.name}/source-notices.txt`)}">Project licenses</a><a class="text-inherit underline underline-offset-4" href="/assets/project-previews/provenance.json">Capture provenance</a><a class="text-inherit underline underline-offset-4" href="/assets/embeds/experiment-gallery-notices.txt">Gallery software notices</a></nav><div class="mt-auto flex flex-col gap-2.5"><a class="${ghost}" href="${safeUrl(directoryIssue(project))}" target="_blank" rel="noopener noreferrer">${lucideSvg(Bug, "size-4")}Report an issue</a><a class="${ghost}" href="${escapeHtml(base)}">${lucideSvg(ArrowLeft, "size-4")}All experiments</a><nav class="flex justify-center gap-0.5" aria-label="Project navigation">${step(previous, "Previous project", ArrowLeft)}${step(next, "Next project", ArrowRight)}</nav></div></aside>`;
}

export function renderDirectoryProject(
  projects: readonly DirectoryProject[],
  name: string,
  route: string,
): string {
  const { project, index } = directoryProjectAt(projects, name);
  const base = directoryBase(route, 0);
  const near = (offset: number): string | undefined => {
    const neighbour = projects[index + offset];
    return neighbour ? directoryProjectRoute(base, neighbour) : undefined;
  };
  const glow = project.thumbnail
    ? `<img class="absolute inset-0 size-full scale-125 object-cover blur-[100px] saturate-150" src="${safeUrl(project.thumbnail)}" alt="" aria-hidden="true" data-project-backdrop><div class="absolute inset-0 bg-bg/20 dark:bg-bg/40"></div>`
    : "";
  return `<div class="relative -mx-8 -mt-6 min-h-[calc(100dvh-7rem)] overflow-hidden max-sm:-mx-4 min-[64rem]:h-[calc(100dvh-7rem)] min-[64rem]:min-h-0">${glow}<section class="relative flex flex-col gap-4 p-4 sm:p-6 min-[64rem]:grid min-[64rem]:h-full min-[64rem]:grid-cols-[minmax(0,1fr)_360px] min-[64rem]:grid-rows-1 min-[64rem]:gap-5 min-[64rem]:overflow-hidden" data-project data-project-path="${escapeHtml(project.path)}">${sidebar(project, base, near(-1), near(1))}${preview(project)}</section></div>`;
}
