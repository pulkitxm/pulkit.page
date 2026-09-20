import { matchBlockEmbed, matchInlineEmbed } from "@pulkit/embeds";
import { markdownProcessor as markdown } from "@pulkit/shared/markdown";
import { collectionItems, listingLimit } from "../render/listings.ts";
import { projectListFor, projectListKey, projectsLine } from "../render/projects.ts";
import type { ListedPage, PageRecord, Site } from "../types.ts";
import { demoMarkdown, embedMarkdown } from "./embed-markdown.ts";
import type { MarkdownNode } from "./html-fallback.ts";
import { entryLine, imageTo, linkTo, type ResolveUrl } from "./markdown-links.ts";

export interface DirectiveContext {
  resolve: ResolveUrl;
  snippets: string[];
  notes: string[];
  page: PageRecord;
  pages: readonly ListedPage[];
  site: Site;
}

function listingMarkdown(
  context: DirectiveContext,
  collection: string,
  limit: string | undefined,
  byYear: boolean,
): string {
  const { pages, page, site, resolve } = context;
  const items = collectionItems(pages, page.route, collection, listingLimit(limit), site);
  if (!byYear) {
    return items.map((entry) => entryLine(entry, resolve)).join("\n");
  }
  const years = Map.groupBy(items, (entry) => (entry.metadata.date ?? "").slice(0, 4));
  return [...years]
    .map(
      ([year, entries]) =>
        `## ${year}\n\n${entries.map((entry) => entryLine(entry, resolve)).join("\n")}`,
    )
    .join("\n\n");
}

function projectsMarkdown(site: Site, login: string, slug: string): string {
  const list = projectListFor(site, projectListKey(login, slug));
  const rows = list.projects.map((project) => {
    const facts = `${project.stars} stars`;
    const summary = project.description ? ` - ${project.description}` : "";
    return `- ${linkTo(project.name, project.url)} (${facts})${summary}`;
  });
  return [list.description, rows.join("\n")].filter(Boolean).join("\n\n");
}

function codeRanges(body: string): [number, number][] {
  const ranges: [number, number][] = [];
  function walk(node: MarkdownNode): void {
    if (node.type === "code") {
      ranges.push([node.position?.start.offset ?? 0, node.position?.end.offset ?? 0]);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(markdown.parse(body));
  return ranges;
}

function outsideCode(body: string, transform: (segment: string) => string): string {
  let output = "";
  let cursor = 0;
  for (const [start, end] of codeRanges(body)) {
    output += transform(body.slice(cursor, start)) + body.slice(start, end);
    cursor = end;
  }
  return output + transform(body.slice(cursor));
}

function replaceInlineEmbeds(
  segment: string,
  context: DirectiveContext,
  token: (value: string) => string,
): string {
  let text = segment;
  let scan = text.indexOf(":embed[");
  while (scan !== -1) {
    const match = matchInlineEmbed(text.slice(scan));
    if (match) {
      const markdownText = embedMarkdown(
        match.name,
        match.props,
        context.resolve,
        true,
        context.notes,
      );
      text = `${text.slice(0, scan)}${token(markdownText)}${text.slice(scan + match.raw.length)}`;
    }
    scan = text.indexOf(":embed[", scan + 1);
  }
  return text;
}

export function replaceDirectives(body: string, context: DirectiveContext): string {
  const { resolve, snippets, notes, page, site } = context;
  const token = (value: string): string => {
    snippets.push(value);
    return `MDSNIPPET${snippets.length - 1}X`;
  };
  const pageUrl = `${site.url}${page.route}`;
  return outsideCode(body, (segment) => {
    const text = segment
      .replace(/^:::embed [^\n]*\n[^\n]*\n:::$/gm, (block) => {
        const match = matchBlockEmbed(`${block}\n`);
        if (!match) {
          throw new Error(`Invalid embed directive: ${block.slice(0, 60)}`);
        }
        return token(embedMarkdown(match.name, match.props, resolve, false, notes));
      })
      .replace(
        /^:::demo ([a-z0-9-]+)(?: ([a-z0-9-]+))?[ \t]*$/gm,
        (_, name: string, variant: string | undefined) =>
          token(demoMarkdown(name, variant, pageUrl)),
      )
      .replace(
        /^:::list ((?:[a-z0-9-]+:all)|[a-z0-9/-]+)(?: limit=([1-9][0-9]*))?( by-year)?[ \t]*$/gm,
        (_, collection: string, limit: string | undefined, byYear: string | undefined) =>
          token(listingMarkdown(context, collection, limit, Boolean(byYear))),
      )
      .replace(projectsLine, (_, login: string, slug: string) =>
        token(projectsMarkdown(site, login, slug)),
      )
      .replace(/^:::carousel[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm, (_, images: string) =>
        token(
          [...images.matchAll(/!\[([^\]\n]+)\]\(([^)\s]+)\)/g)]
            .map(([, alt = "", src = ""]) => imageTo(alt, resolve(src)))
            .join("\n\n"),
        ),
      );
    return replaceInlineEmbeds(text, context, token);
  });
}
