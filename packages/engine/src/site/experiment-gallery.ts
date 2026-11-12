import process from "node:process";
import { readExperimentCatalog } from "@pulkit/shared/experiment-catalog";
import { experimentIndexSchema } from "@pulkit/shared/experiments";
import { repositoryRoot } from "@pulkit/shared/repository";
import { stringify } from "yaml";
import {
  directoryFor,
  directoryIndexPath,
  directoryPageCount,
  directoryPageRoute,
  directoryProjectRoute,
} from "../render/experiment-gallery.ts";
import type { Directory, DirectoryProject, Page, PageMetadata, SiteContext } from "../types.ts";
import { readPage } from "./read-page.ts";

interface StarsRequestOptions {
  request?: (url: string, options: RequestInit) => Promise<Response>;
  token?: string;
  timeoutMs?: number;
}

export async function fetchDirectoryStars({
  request = fetch,
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
  timeoutMs = 5000,
}: StarsRequestOptions = {}): Promise<number> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) {
    throw new Error("The repository metadata request requires a bounded timeout");
  }
  const headers = new Headers({
    accept: "application/vnd.github+json",
    "user-agent": "pulkit.page-build",
  });
  if (token.trim()) {
    headers.set("authorization", `Bearer ${token.trim()}`);
  }
  try {
    const response = await request("https://api.github.com/repos/pulkitxm/claude-directory", {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
      credentials: "omit",
    });
    if (!response.ok) {
      throw new Error("Repository metadata is unavailable");
    }
    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("full_name" in body) ||
      body.full_name !== "pulkitxm/claude-directory" ||
      !("html_url" in body) ||
      body.html_url !== "https://github.com/pulkitxm/claude-directory" ||
      !("stargazers_count" in body) ||
      typeof body.stargazers_count !== "number" ||
      !Number.isSafeInteger(body.stargazers_count) ||
      body.stargazers_count < 0
    ) {
      throw new Error("Repository metadata has an invalid star count");
    }
    return body.stargazers_count;
  } catch (error) {
    throw new Error("Could not retrieve the GitHub repository star count", { cause: error });
  }
}

export async function loadDirectory(root = repositoryRoot): Promise<Directory> {
  const catalog = readExperimentCatalog(root);
  return { ...catalog, stars: await fetchDirectoryStars() };
}

const directoryPageLine = /^:::experiment-gallery[ \t]*$/m;

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
    `:::experiment-gallery page=${number}`,
  );
}

function projectPage(page: Page, project: DirectoryProject): Page {
  return generatedPage(
    page,
    directoryProjectRoute(page.route, project),
    {
      title: project.title,
      description: project.description,
      tags: [project.category],
      ...(page.metadata.layout && { layout: page.metadata.layout }),
    },
    `:::experiment-gallery project=${project.name}`,
    ":::experiment-gallery\n",
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
          page,
          ...Array.from({ length: count - 1 }, (_, index) => numberedPage(page, index + 2, count)),
          ...projects.map((project) => projectPage(page, project)),
        ]
      : [page],
  );
}

export function directoryOutputs(pages: readonly Page[], site: SiteContext): Map<string, Buffer> {
  return new Map(
    pages.filter(hasDirectory).map((page) => [
      directoryIndexPath(page.route).slice(1),
      Buffer.from(
        JSON.stringify(
          experimentIndexSchema.parse({
            version: 1,
            revision: site.directory?.revision,
            projects: directoryFor(site),
          }),
        ),
      ),
    ]),
  );
}
