import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { escapeHtml } from "@pulkit/shared/html";
import { faSvg, lucideSvg } from "@pulkit/shared/icons";
import { ArrowLeft, ArrowRight, Bug, Code2, Copy, Download, ExternalLink, Play } from "lucide";
import { parentRoute } from "../seo/routes.ts";
import type { DirectoryProject } from "../types.ts";
import { directoryProjectRoute, directoryScript } from "./claude-directory.ts";
import {
  directoryDemo,
  directoryDownload,
  directoryIssue,
  directoryPoster,
  directoryPrompt,
  directorySource,
  mediaOrigin,
  pill,
} from "./claude-directory-card.ts";
import { safeUrl } from "./html.ts";
import type { PageAssets } from "./render-context.ts";

const repository = "https://github.com/pulkitxm/claude-directory";

const button =
  "inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[6px] px-4 py-2 font-medium text-md no-underline [font:inherit] transition-[color,background-color,box-shadow]";
const outline = `${button} border border-line bg-bg text-fg shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:bg-surface`;
const ghost = `${button} border-0 bg-transparent text-fg hover:bg-surface`;
const primary = `${button} h-12 border-0 bg-fg text-base text-bg shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:bg-fg/90`;
const segment =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[6px] border-0 bg-transparent px-3 py-1.5 font-medium text-md text-muted [font:inherit] transition-colors hover:text-fg aria-pressed:bg-bg aria-pressed:text-fg aria-pressed:shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]";
const arrow =
  "inline-flex size-8 items-center justify-center rounded-[6px] text-fg no-underline transition-colors hover:bg-surface";
const pane = "rounded-[16px] border border-fg/10 bg-bg/80";

export interface DirectoryProjectLinks {
  project: DirectoryProject;
  live: string | undefined;
  promptSource: string;
}

export function directoryProjectLinks(project: DirectoryProject): DirectoryProjectLinks {
  return {
    project,
    live: project.published ? `${mediaOrigin}${project.path}/` : undefined,
    promptSource: `${repository}/blob/main/${project.path}/prompt.md`,
  };
}

export function directoryProjectAt(
  projects: readonly DirectoryProject[],
  name: string,
): { project: DirectoryProject; index: number } {
  const index = projects.findIndex((entry) => entry.name === name);
  const project = projects[index];
  if (!project) {
    throw new Error(`The Claude Directory has no project ${name}`);
  }
  return { project, index };
}

function demo(project: DirectoryProject): string {
  const frame =
    "aspect-[1280/800] w-full max-w-[56rem] overflow-hidden rounded-[12px] border border-[#000]/10 shadow-[0_40px_100px_-20px_rgb(0_0_0/0.85)] dark:border-[#fff]/10";
  const content = project.published
    ? `<!-- [html-validate-disable-next no-autoplay] --><video class="block size-full object-cover" data-src="${safeUrl(directoryDemo(project))}" poster="${safeUrl(directoryPoster(project))}" title="${escapeHtml(`Demo of ${project.title}`)}" autoplay muted loop playsinline preload="none" data-demo-video></video>`
    : '<div class="flex size-full items-center justify-center bg-surface/40 text-md text-muted">No preview available</div>';
  return `<div class="relative order-2 aspect-[16/9] min-w-0 overflow-hidden rounded-[16px] border border-line/40 min-[64rem]:order-1 min-[64rem]:aspect-auto min-[64rem]:h-full min-[64rem]:min-h-0" data-project-panel="preview"><div class="absolute inset-0 flex items-center justify-center p-4 sm:p-8 min-[64rem]:p-14"><div class="${frame}">${content}</div></div></div>`;
}

function sidebar(
  project: DirectoryProject,
  previous: string | undefined,
  next: string | undefined,
): string {
  const links = directoryProjectLinks(project);
  const step = (href: string | undefined, label: string, icon: typeof ArrowLeft): string =>
    href
      ? `<a class="${arrow}" href="${escapeHtml(href)}" aria-label="${label}">${lucideSvg(icon, "size-4 opacity-70")}</a>`
      : "";
  const live = links.live
    ? `<a class="${outline}" href="${safeUrl(links.live)}" target="_blank" rel="noopener noreferrer">${lucideSvg(ExternalLink, "size-4")}Open live preview</a>`
    : "";
  return `<aside class="order-1 flex flex-col gap-5 ${pane} p-6 min-[64rem]:order-2 min-[64rem]:overflow-y-auto" aria-label="Project details"><div><h1 class="m-0 text-[24px]/[32px] font-bold tracking-tight text-fg sm:text-[30px]/[36px]" data-title>${escapeHtml(project.title)}</h1><p class="mt-2 mb-0 text-md text-fg/70">Built with Claude from a single prompt.</p></div><span class="${pill} px-2.5 py-0.5 text-xs">${escapeHtml(project.category)}</span><div class="grid grid-cols-2 gap-1 rounded-[8px] border border-line/60 bg-surface/30 p-1" role="group" aria-label="View"><button class="${segment}" type="button" aria-pressed="true" data-project-view="preview">${lucideSvg(Play, "size-3.5")}Preview</button><button class="${segment}" type="button" aria-pressed="false" data-project-view="code">${lucideSvg(Code2, "size-3.5")}Code</button></div><div class="flex flex-col gap-2.5"><button class="${primary}" type="button" data-prompt-copy data-prompt="${safeUrl(directoryPrompt(project))}">${lucideSvg(Copy, "size-4")}Copy prompt</button>${live}<a class="${outline}" href="${safeUrl(directoryDownload(project))}" target="_blank" rel="noopener noreferrer">${lucideSvg(Download, "size-4")}Download</a><a class="${outline}" href="${safeUrl(directorySource(project))}" target="_blank" rel="noopener noreferrer">${faSvg(faGithub, "size-4")}View on GitHub</a></div><div class="mt-auto flex flex-col gap-2.5"><a class="${ghost}" href="${safeUrl(directoryIssue(project))}" target="_blank" rel="noopener noreferrer">${lucideSvg(Bug, "size-4")}Report an issue</a><div class="flex justify-center"><div class="flex items-center gap-0.5">${step(previous, "Previous project", ArrowLeft)}${step(next, "Next project", ArrowRight)}</div></div></div></aside>`;
}

export function renderDirectoryProject(
  projects: readonly DirectoryProject[],
  name: string,
  route: string,
  assets: PageAssets,
): string {
  assets.script(directoryScript);
  const { project, index } = directoryProjectAt(projects, name);
  const base = parentRoute(route);
  const near = (offset: number): string | undefined => {
    const neighbour = projects[index + offset];
    return neighbour ? directoryProjectRoute(base, neighbour) : undefined;
  };
  const backdrop = project.blur || (project.published ? directoryPoster(project) : "");
  const glow = backdrop
    ? `<img class="absolute inset-0 size-full scale-125 object-cover blur-[100px] saturate-150" src="${escapeHtml(backdrop)}" alt="" aria-hidden="true"><div class="absolute inset-0 bg-bg/20 dark:bg-bg/40"></div>`
    : "";
  return `<div class="relative -mx-8 -mt-6 min-h-[calc(100dvh-7rem)] overflow-hidden max-sm:-mx-4 min-[64rem]:h-[calc(100dvh-7rem)] min-[64rem]:min-h-0">${glow}<section class="relative flex flex-col gap-4 p-4 sm:p-6 min-[64rem]:grid min-[64rem]:h-full min-[64rem]:grid-cols-[minmax(0,1fr)_360px] min-[64rem]:grid-rows-1 min-[64rem]:gap-5 min-[64rem]:overflow-hidden" data-project data-project-path="${escapeHtml(project.path)}">${sidebar(project, near(-1), near(1))}${demo(project)}<div class="order-2 min-h-[480px] min-w-0 min-[64rem]:order-1 min-[64rem]:h-full min-[64rem]:min-h-0" hidden data-project-panel="code"></div></section></div>`;
}
