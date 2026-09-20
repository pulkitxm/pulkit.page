import { unescapeHtml } from "@pulkit/shared/html";
import type { ListedProject, ProjectList } from "../types.ts";

const entryPattern = /<h2[^>]*>\s*<a href="\/([\w.-]+)\/([\w.-]+)"/g;
const descriptionPattern = /itemprop="description"[^>]*>([\s\S]*?)<\/p>/;
const listDescriptionPattern = /<meta name="twitter:description" content="([^"]*)"/;

function listUrl(login: string, slug: string): string {
  return `https://github.com/stars/${login}/lists/${slug}`;
}

function plain(value: string): string {
  return unescapeHtml(value.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function starsIn(block: string, login: string, name: string): number {
  const pattern = new RegExp(`/${login}/${name}/stargazers"[\\s\\S]*?<\\/svg>\\s*([\\d,]+)`);
  return Number((pattern.exec(block)?.[1] ?? "0").replace(/,/g, ""));
}

function readEntries(html: string): ListedProject[] {
  const matches = [...html.matchAll(entryPattern)];
  return matches.map((match, index): ListedProject => {
    const [login = "", name = ""] = [match[1] ?? "", match[2] ?? ""];
    const block = html.slice(match.index, matches[index + 1]?.index ?? html.length);
    const description = plain(descriptionPattern.exec(block)?.[1] ?? "");
    return {
      name,
      url: `https://github.com/${login}/${name}`,
      stars: starsIn(block, login, name),
      ...(description && { description }),
    };
  });
}

async function fullDescription(project: ListedProject): Promise<ListedProject> {
  const path = project.url.replace("https://github.com/", "");
  try {
    const response = await fetch(`https://api.github.com/repos/${path}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "pulkit.page-build" },
    });
    if (!response.ok) {
      return project;
    }
    const body: unknown = await response.json();
    const description =
      typeof body === "object" && body !== null && "description" in body
        ? String(body.description ?? "").trim()
        : "";
    return description ? { ...project, description } : project;
  } catch {
    return project;
  }
}

function resolveTruncated(projects: readonly ListedProject[]): Promise<ListedProject[]> {
  return Promise.all(
    projects.map((project) =>
      project.description?.endsWith("…") ? fullDescription(project) : project,
    ),
  );
}

export async function fetchProjectList(login: string, slug: string): Promise<ProjectList> {
  const url = listUrl(login, slug);
  const response = await fetch(url, {
    headers: { accept: "text/html", "user-agent": "pulkit.page-build" },
  });
  if (!response.ok) {
    throw new Error(`GitHub replied ${response.status} ${response.statusText} for ${url}`);
  }
  const html = await response.text();
  const projects = (await resolveTruncated(readEntries(html))).sort(
    (left, right) => right.stars - left.stars || left.name.localeCompare(right.name),
  );
  if (projects.length === 0) {
    throw new Error(
      `No repositories were found on ${url}. The list may be empty or private, or GitHub changed the page markup that this parser depends on.`,
    );
  }
  return {
    description: plain(listDescriptionPattern.exec(html)?.[1] ?? ""),
    projects,
  };
}
