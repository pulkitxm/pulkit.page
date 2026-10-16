import { escapeHtml } from "@pulkit/shared/html";
import { parentRoute } from "../seo/routes.ts";
import type { DirectoryProject } from "../types.ts";
import {
  directoryPageRoute,
  directoryPoster,
  directoryProjectRoute,
  directorySource,
  mediaOrigin,
  pageSize,
} from "./claude-directory.ts";
import { safeUrl } from "./html.ts";
import type { PageAssets } from "./render-context.ts";

const repository = "https://github.com/pulkitxm/claude-directory";
const rawOrigin = "https://raw.githubusercontent.com/pulkitxm/claude-directory/main/";

const action =
  "cursor-pointer rounded-md border border-line bg-transparent px-4 py-2.5 text-center text-sm text-inherit no-underline [font:inherit] hover:bg-surface";

const primaryAction =
  "cursor-pointer rounded-md border border-fg bg-fg px-4 py-2.5 text-center text-sm text-bg [font:inherit] hover:opacity-90";

const stepLink = "text-inherit decoration-muted underline-offset-4 hover:decoration-current";

export interface DirectoryProjectLinks {
  project: DirectoryProject;
  live: string | undefined;
  prompt: string;
  promptSource: string;
  download: string;
  issue: string;
}

export function directoryProjectLinks(project: DirectoryProject): DirectoryProjectLinks {
  const source = directorySource(project);
  return {
    project,
    live: project.published ? `${mediaOrigin}${project.path}/` : undefined,
    prompt: `${rawOrigin}${project.path}/prompt.md`,
    promptSource: `${repository}/blob/main/${project.path}/prompt.md`,
    download: `https://download-directory.github.io/?url=${encodeURIComponent(source)}`,
    issue: `${repository}/issues/new?title=${encodeURIComponent(`Issue with ${project.name}`)}`,
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

function media(project: DirectoryProject): string {
  if (!project.published) {
    return "No preview";
  }
  return `<video class="block size-full object-cover" src="${safeUrl(`${mediaOrigin}${project.path}/demo.mp4`)}" poster="${safeUrl(directoryPoster(project))}" aria-label="${escapeHtml(`Demo of ${project.name}`)}" controls muted loop playsinline preload="none"></video>`;
}

function fact(label: string, value: string): string {
  return `<div><dt class="text-2xs tracking-[0.06em] text-muted uppercase">${label}</dt><dd class="m-0 mt-1">${escapeHtml(value)}</dd></div>`;
}

function actions(links: DirectoryProjectLinks): string {
  const link = (href: string, label: string): string =>
    `<a class="${action}" href="${safeUrl(href)}">${label}</a>`;
  return [
    `<button class="${primaryAction}" type="button" hidden data-prompt-copy data-prompt="${safeUrl(links.prompt)}">Copy prompt</button>`,
    links.live ? link(links.live, "Open live preview") : "",
    link(links.promptSource, "Read the prompt"),
    link(links.download, "Download the code"),
    link(directorySource(links.project), "View on GitHub"),
    link(links.issue, "Report an issue"),
  ].join("");
}

function steps(projects: readonly DirectoryProject[], index: number, base: string): string {
  const previous = projects[index - 1];
  const next = projects[index + 1];
  const page = Math.floor(index / pageSize) + 1;
  const step = (project: DirectoryProject | undefined, label: string): string =>
    project
      ? `<a class="${stepLink}" href="${escapeHtml(directoryProjectRoute(base, project))}">${label}: ${escapeHtml(project.name)}</a>`
      : "<span></span>";
  return `<nav class="mt-10 grid gap-3 text-sm sm:grid-cols-3" aria-label="More projects">${step(previous, "Previous")}<a class="${stepLink} sm:text-center" href="${escapeHtml(directoryPageRoute(base, page))}">Back to page ${page}</a><span class="sm:text-right">${next ? step(next, "Next") : ""}</span></nav>`;
}

export function renderDirectoryProject(
  projects: readonly DirectoryProject[],
  name: string,
  route: string,
  assets: PageAssets,
): string {
  assets.script("/assets/embeds/claude-directory.js");
  const { project, index } = directoryProjectAt(projects, name);
  if (project.published) {
    assets.script("/assets/embeds/video-player.js");
  }
  const links = directoryProjectLinks(project);
  return `<div class="grid gap-8 min-[64rem]:grid-cols-[minmax(0,1fr)_340px] min-[64rem]:items-start"><div class="min-w-0"><div class="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg border border-line bg-surface text-sm text-muted">${media(project)}</div><p class="mt-6 mb-0 max-w-190">${escapeHtml(project.description)}</p></div><aside class="grid gap-6 rounded-lg border border-line p-5 min-[64rem]:sticky min-[64rem]:top-6" aria-label="Project details"><dl class="m-0 grid gap-4 text-sm">${fact("Category", project.category)}${fact("Stack", project.stack)}</dl><div class="grid gap-2.5">${actions(links)}</div></aside></div>${steps(projects, index, parentRoute(route))}`;
}
