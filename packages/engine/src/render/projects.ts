import { escapeHtml } from "@pulkit/shared/html";
import type { ListedProject, ProjectList, SiteContext } from "../types.ts";
import { safeUrl } from "./html.ts";

export const projectsDirective = /^:::projects ([\w.-]+)\/([a-z0-9-]+)\s*(?:\n|$)/;

export const projectsLine = /^:::projects ([\w.-]+)\/([a-z0-9-]+)[ \t]*$/gm;

const iconAttributes =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const starIcon = `<svg ${iconAttributes} class="size-3"><path d="M11.5 2.3a.6.6 0 0 1 1 0l2.5 5.2 5.6.8c.5.1.7.7.3 1l-4 4 1 5.6a.6.6 0 0 1-.9.6l-5-2.6-5 2.6a.6.6 0 0 1-.9-.6l1-5.6-4-4c-.4-.3-.2-.9.3-1l5.6-.8Z"/></svg>`;

export function projectListKey(login: string, slug: string): string {
  return `${login}/${slug}`;
}

export function projectListFor(site: SiteContext, key: string): ProjectList {
  const list = site.projects?.[key];
  if (!list) {
    throw new Error(`No starred list was loaded for ${key}`);
  }
  return list;
}

function meta(project: ListedProject): string {
  return `<span class="inline-flex items-center gap-1 whitespace-nowrap text-2xs text-muted tabular-nums">${starIcon}${project.stars}</span>`;
}

function entry(project: ListedProject): string {
  const heading = `<a class="group inline-flex items-center gap-2.5 font-medium text-inherit no-underline underline-offset-4" href="${safeUrl(project.url)}" rel="noopener"><span class="group-hover:underline">${escapeHtml(project.name)}</span>${meta(project)}</a>`;
  const description = project.description
    ? `<p class="m-0 text-muted text-sm leading-normal">${escapeHtml(project.description)}</p>`
    : "";
  return `<li class="border-b border-line"><div class="grid gap-1.5 py-4.5"><div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">${heading}</div>${description}</div></li>`;
}

export function renderProjects(list: ProjectList): string {
  const intro = list.description ? `<p class="mt-0 mb-7">${escapeHtml(list.description)}</p>` : "";
  return `${intro}<ul class="mt-2 mb-8 list-none border-t border-line p-0">${list.projects.map(entry).join("")}</ul>`;
}
