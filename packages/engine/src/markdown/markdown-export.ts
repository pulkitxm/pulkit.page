import { markdownProcessor as markdown } from "@pulkit/shared/markdown";
import { longDate } from "../render/html.ts";
import { childCollections, isArticle, markdownPath, relatedPages } from "../seo/routes.ts";
import type { ListedPage, PageRecord, Site } from "../types.ts";
import { replaceDirectives } from "./directive-markdown.ts";
import { transformTree } from "./html-fallback.ts";
import { llmsText } from "./llms-text.ts";
import { entryLine, linkTo, markdownResolver, quote, type ResolveUrl } from "./markdown-links.ts";

function header(
  page: PageRecord,
  pages: readonly ListedPage[],
  site: Site,
  resolve: ResolveUrl,
): string {
  const { metadata } = page;
  const facts = [`- URL: ${site.url}${page.route}`];
  if (isArticle(page.route, pages, site) && metadata.date) {
    facts.push(`- Published: ${longDate(metadata.date)}`);
  }
  if (metadata.role) {
    facts.push(`- Role: ${metadata.role}`);
  }
  if (metadata.period) {
    facts.push(`- Period: ${metadata.period}`);
  }
  if (metadata.tags?.length) {
    facts.push(`- Tags: ${metadata.tags.join(", ")}`);
  }
  const [parent] = pages
    .filter(
      (candidate) =>
        candidate.index && candidate.route !== page.route && page.route.startsWith(candidate.route),
    )
    .sort((a, b) => b.route.length - a.route.length);
  if (parent) {
    facts.push(`- Part of: ${linkTo(parent.metadata.title, resolve(parent.route))}`);
  }
  return `# ${metadata.title}\n\n${quote(metadata.description ?? "")}\n\n${facts.join("\n")}`;
}

function footer(
  page: PageRecord,
  pages: readonly ListedPage[],
  site: Site,
  resolve: ResolveUrl,
): string {
  const sections: string[] = [];
  const collections = page.route === "/" ? [] : childCollections(page.route, pages);
  if (collections.length > 0) {
    sections.push(
      `## Explore collections\n\n${collections.map((entry) => `- ${linkTo(entry.metadata.title, resolve(entry.route))}`).join("\n")}`,
    );
  }
  const related = relatedPages(page.route, page.metadata, pages, site);
  if (related.length > 0) {
    sections.push(
      `## Related writing\n\n${related.map((entry) => entryLine(entry, resolve)).join("\n")}`,
    );
  }
  return sections.join("\n\n");
}

export function renderMarkdown(page: PageRecord, pages: readonly ListedPage[], site: Site): string {
  const resolve = markdownResolver(pages, site);
  const snippets: string[] = [];
  const notes: string[] = [];
  const body = replaceDirectives(page.body, { resolve, snippets, notes, page, pages, site });
  const tree = markdown.parse(body);
  transformTree(tree, resolve);
  const content = markdown
    .stringify(tree)
    .replace(/MDSNIPPET(\d+)X/g, (_, index: string) => snippets[Number(index)] ?? "")
    .trim();
  const footnotes = notes.map((note, index) => `[^${index + 1}]: ${note}`).join("\n");
  return `${[
    header(page, pages, site, resolve),
    content,
    footer(page, pages, site, resolve),
    footnotes,
  ]
    .filter(Boolean)
    .join("\n\n")}\n`;
}

export function markdownOutputs(pages: readonly PageRecord[], site: Site): Map<string, Buffer> {
  const output = new Map<string, Buffer>();
  for (const page of pages) {
    output.set(markdownPath(page.route).slice(1), Buffer.from(renderMarkdown(page, pages, site)));
  }
  output.set("llms.txt", Buffer.from(llmsText(pages, site)));
  return output;
}
