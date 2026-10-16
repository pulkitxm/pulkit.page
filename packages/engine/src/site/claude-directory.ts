import { unescapeHtml } from "@pulkit/shared/html";
import { stringify } from "yaml";
import { isRecord } from "../lib/guards.ts";
import {
  directoryFor,
  directoryIndexPath,
  directoryPageCount,
  directoryPageRoute,
  directoryProjectRoute,
} from "../render/claude-directory.ts";
import type { DirectoryProject, Page, PageMetadata, SiteContext } from "../types.ts";
import { readPage } from "./read-page.ts";

const repository = "https://raw.githubusercontent.com/pulkitxm/claude-directory/main/";
const sectionPattern = /^<summary><b>(.+?) \(\d+\)<\/b><\/summary>$/;
const rowPattern = /^\| \[[^\]]+\]\(\.\/([\w./-]+?)\/?\) \| (.+) \| (.+) \|$/;
const summaryLength = 180;
const dashPattern = new RegExp(`\\s*${String.fromCodePoint(0x2014)}\\s*`, "g");

function plain(value: string): string {
  return unescapeHtml(value.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*`]/g, ""))
    .replace(dashPattern, ", ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text: string): string {
  if (text.length <= summaryLength) {
    return text;
  }
  const cut = text.slice(0, summaryLength);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.]+$/, "")}…`;
}

function updatedDates(value: unknown): Map<string, string> {
  if (!Array.isArray(value)) {
    throw new Error("project-dates.json must be an array");
  }
  return new Map(
    value.flatMap((entry) =>
      isRecord(entry) && typeof entry.project === "string" && typeof entry.lastUpdated === "string"
        ? [[entry.project, entry.lastUpdated] as const]
        : [],
    ),
  );
}

export function parseDirectory(
  readme: string,
  posters: unknown,
  dates: unknown,
): DirectoryProject[] {
  if (!isRecord(posters)) {
    throw new Error("posters.json must be an object keyed by project path");
  }
  const updated = updatedDates(dates);
  let category = "";
  const projects: DirectoryProject[] = [];
  for (const line of readme.split("\n")) {
    const section = sectionPattern.exec(line.trim());
    if (section) {
      category = unescapeHtml(section[1] ?? "");
      continue;
    }
    if (!line.startsWith("| [")) {
      continue;
    }
    const [, path = "", description = "", stack = ""] = rowPattern.exec(line) ?? [];
    const name = path.split("/").at(-1);
    if (!(name && category)) {
      throw new Error(`Unreadable Claude Directory row: ${line.slice(0, 80)}`);
    }
    if (/^[0-9]+$/.test(name) || projects.some((project) => project.name === name)) {
      throw new Error(`Claude Directory project names must be unique and not numeric: ${name}`);
    }
    const text = plain(description);
    projects.push({
      path,
      name,
      category,
      summary: shorten(text),
      description: text,
      stack: plain(stack),
      published: Object.hasOwn(posters, path),
    });
  }
  if (projects.length === 0) {
    throw new Error("The Claude Directory README lists no projects");
  }
  return projects
    .map((project, order) => ({ project, order, date: updated.get(project.name) ?? "" }))
    .sort((left, right) => right.date.localeCompare(left.date) || left.order - right.order)
    .map(({ project }) => project);
}

async function download(file: string): Promise<string> {
  const response = await fetch(repository + file, {
    headers: { "user-agent": "pulkit.page-build" },
  });
  if (!response.ok) {
    throw new Error(`GitHub replied ${response.status} ${response.statusText} for ${file}`);
  }
  return response.text();
}

export async function fetchDirectory(): Promise<DirectoryProject[]> {
  const [readme, posters, dates] = await Promise.all(
    ["README.md", "posters.json", "project-dates.json"].map(download),
  );
  return parseDirectory(readme ?? "", JSON.parse(posters ?? ""), JSON.parse(dates ?? ""));
}

const directoryPageLine = /^:::claude-directory[ \t]*$/m;

export function hasDirectory(page: { body: string }): boolean {
  return directoryPageLine.test(page.body);
}

function generatedPage(
  page: Page,
  route: string,
  metadata: PageMetadata,
  directive: string,
  body = page.body,
): Page {
  const text = `---\n${stringify(metadata)}---\n${body.replace(directoryPageLine, directive)}`;
  return { source: page.source, text, ...readPage(text), route, index: false };
}

function numberedPage(page: Page, number: number, count: number): Page {
  const { metadata } = page;
  return generatedPage(
    page,
    directoryPageRoute(page.route, number),
    {
      ...metadata,
      title: `${metadata.title}, page ${number}`,
      description: `${metadata.description ?? metadata.title} Page ${number} of ${count}.`,
    },
    `:::claude-directory page=${number}`,
  );
}

function projectPage(page: Page, project: DirectoryProject): Page {
  return generatedPage(
    page,
    directoryProjectRoute(page.route, project),
    {
      title: project.name,
      description: project.description,
      ...(page.metadata.layout && { layout: page.metadata.layout }),
    },
    `:::claude-directory project=${project.name}`,
    ":::claude-directory\n",
  );
}

export function withDirectoryPages(
  pages: readonly Page[],
  projects: readonly DirectoryProject[],
): Page[] {
  const count = directoryPageCount(projects);
  return pages.flatMap((page) =>
    hasDirectory(page)
      ? [
          { ...page, index: true },
          ...Array.from({ length: count - 1 }, (_, index) => numberedPage(page, index + 2, count)),
          ...projects.map((project) => projectPage(page, project)),
        ]
      : [page],
  );
}

export function directoryOutputs(pages: readonly Page[], site: SiteContext): Map<string, Buffer> {
  return new Map(
    pages
      .filter(hasDirectory)
      .map((page) => [
        directoryIndexPath(page.route).slice(1),
        Buffer.from(
          JSON.stringify(directoryFor(site).map(({ description: _, ...project }) => project)),
        ),
      ]),
  );
}
