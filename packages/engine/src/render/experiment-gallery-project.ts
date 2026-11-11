import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { escapeHtml } from "@pulkit/shared/html";
import { faSvg, lucideSvg } from "@pulkit/shared/icons";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide";
import type { DirectoryProject } from "../types.ts";
import { directoryBase, directoryProjectRoute } from "./experiment-gallery.ts";
import { directoryIssue, directoryRecording, pill } from "./experiment-gallery-card.ts";
import { safeUrl } from "./html.ts";

const button =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] border px-4 py-2 font-medium text-md no-underline transition-colors";
const secondary = `${button} border-line bg-bg text-fg hover:bg-surface`;
const arrow =
  "inline-flex size-9 items-center justify-center rounded-[6px] text-fg no-underline transition-colors hover:bg-surface";

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

export function renderDirectoryProject(
  projects: readonly DirectoryProject[],
  name: string,
  route: string,
): string {
  const { project, index } = directoryProjectAt(projects, name);
  const base = directoryBase(route, 0);
  const neighbour = (offset: number, label: string, icon: typeof ArrowLeft): string => {
    const entry = projects[index + offset];
    return entry
      ? `<a class="${arrow}" href="${escapeHtml(directoryProjectRoute(base, entry))}" aria-label="${label}">${lucideSvg(icon, "size-4")}</a>`
      : "";
  };
  const recording =
    project.video && project.thumbnail
      ? `<video class="m-0 block aspect-[1280/800] w-full bg-[#000] object-contain" controls playsinline preload="none" poster="${safeUrl(project.thumbnail)}" aria-label="${escapeHtml(project.title)} project recording" data-project-recording><source src="${safeUrl(project.video)}" type="video/mp4">Your browser does not support this recording. <a href="${safeUrl(project.preview)}">Open the current project preview</a>.</video>`
      : `<div class="relative aspect-[1280/800] w-full overflow-hidden">${directoryRecording(project)}</div>`;
  return `<div class="w-full pb-8 sm:pb-12"><a class="mb-5 inline-flex min-h-9 items-center gap-2 text-md text-muted no-underline hover:text-fg" href="${escapeHtml(base)}">${lucideSvg(ArrowLeft, "size-4")}All experiments</a><section class="grid gap-6 min-[64rem]:grid-cols-[minmax(0,1fr)_360px] min-[64rem]:items-start" data-project data-project-path="${escapeHtml(project.path)}"><div class="min-w-0 overflow-hidden rounded-[16px] border border-line bg-surface">${recording}<div class="flex items-center justify-between gap-3 border-t border-line px-5 py-4"><span class="text-xs text-muted">Silent project recording</span><a class="text-xs text-muted underline underline-offset-4" href="/assets/project-previews/provenance.json">Capture provenance</a></div></div><aside class="flex flex-col gap-5 rounded-[16px] border border-line bg-surface/40 p-6" aria-label="Project details"><div><h1 class="m-0 text-[24px]/[32px] font-bold tracking-tight text-fg sm:text-[30px]/[36px]" data-title>${escapeHtml(project.title)}</h1><p class="mt-3 mb-0 text-md leading-relaxed text-muted">${escapeHtml(project.description)}</p></div><span class="${pill} px-2.5 py-0.5 text-xs">${escapeHtml(project.category)}</span><div class="flex flex-col gap-2.5"><a class="${button} border-fg bg-fg text-bg hover:bg-fg/90" href="${safeUrl(project.preview)}" target="_blank" rel="noopener noreferrer">${lucideSvg(ExternalLink, "size-4")}Open current preview</a><a class="${secondary}" href="${safeUrl(project.source)}" target="_blank" rel="noopener noreferrer">${faSvg(faGithub, "size-4")}Source folder</a></div><nav class="flex justify-center gap-1" aria-label="Project navigation">${neighbour(-1, "Previous project", ArrowLeft)}${neighbour(1, "Next project", ArrowRight)}</nav></aside></section><p class="mt-5 text-xs text-muted"><a class="text-inherit underline underline-offset-4" href="${safeUrl(`/assets/project-previews/${project.name}/source-notices.txt`)}">Project licenses</a> · <a class="text-inherit underline underline-offset-4" href="/assets/embeds/experiment-gallery-notices.txt">Gallery software notices</a> · <a class="text-inherit underline underline-offset-4" href="${safeUrl(directoryIssue(project))}" target="_blank" rel="noopener noreferrer">Report an issue</a></p></div>`;
}
