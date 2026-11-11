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

export function loadDirectory(root = repositoryRoot): Directory {
  return { ...readExperimentCatalog(root), stars: 0 };
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
