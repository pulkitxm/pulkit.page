import { arrowIcon } from "../lib/icons.ts";
import { isRecord } from "../lib/props.ts";
import type { EmbedRenderer } from "../types.ts";

interface Project {
  name: string;
  description: string;
  repo: string;
  site?: string;
}

const projectProps = new Set(["name", "description", "repo", "site"]);

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readLink(href: unknown, key: string): string {
  if (!isFilled(href)) {
    throw new Error(`project-list ${key} must be a nonempty string`);
  }
  if (!href.startsWith("https://")) {
    throw new Error(`project-list ${key} must be an https link: ${href}`);
  }
  return href;
}

function readProject(project: unknown): Project {
  if (!isRecord(project)) {
    throw new Error("project-list entries need name, description, and repo");
  }
  for (const key of Object.keys(project)) {
    if (!projectProps.has(key)) {
      throw new Error(`Unknown project-list prop: ${key}`);
    }
  }
  const { name, description, repo, site } = project;
  if (!(isFilled(name) && isFilled(description))) {
    throw new Error("project-list entries need name, description, and repo");
  }
  const entry: Project = { name, description, repo: readLink(repo, "repo") };
  return site === undefined ? entry : { ...entry, site: readLink(site, "site") };
}

function siteLabel(site: string): string {
  return site.replace(/^https:\/\//, "").replace(/\/$/, "");
}

export const render: EmbedRenderer = ({ projects, ...rest }, { escapeHtml }) => {
  if (Object.keys(rest).length > 0 || !Array.isArray(projects) || projects.length === 0) {
    throw new Error("project-list takes a nonempty projects array only");
  }
  const rows = projects.map(readProject).map(({ name, description, repo, site }) => {
    const heading = `<a class="group inline-flex items-center gap-1.5 font-medium text-inherit no-underline underline-offset-4" href="${escapeHtml(repo)}" rel="noopener"><span class="group-hover:underline">${escapeHtml(name)}</span></a>`;
    const live = site
      ? `<a class="group inline-flex shrink-0 items-center gap-1 text-muted text-xs no-underline underline-offset-4 transition-colors duration-150 hover:text-fg max-sm:text-2xs" href="${escapeHtml(site)}" rel="noopener"><span class="group-hover:underline">${escapeHtml(siteLabel(site))}</span><span class="inline-flex transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">${arrowIcon}</span></a>`
      : "";
    return `<li class="border-b border-line"><div class="grid gap-1.5 py-4.5"><div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">${heading}${live}</div><p class="m-0 text-muted text-sm leading-normal">${escapeHtml(description)}</p></div></li>`;
  });
  return `<ul class="mt-2 mb-8 list-none border-t border-line p-0">${rows.join("")}</ul>`;
};
