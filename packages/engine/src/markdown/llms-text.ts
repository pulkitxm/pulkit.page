import { longDate } from "../render/html.ts";
import { isArticle, isNotFound, newestFirstByTitle, parentRoute } from "../seo/routes.ts";
import type { ListedPage, Site } from "../types.ts";
import { linkTo, markdownResolver } from "./markdown-links.ts";

function byRoute(a: ListedPage, b: ListedPage): number {
  return a.route.localeCompare(b.route);
}

export function llmsText(pages: readonly ListedPage[], site: Site): string {
  const resolve = markdownResolver(pages, site);
  const describe = (page: ListedPage): string => {
    const { metadata } = page;
    const dated =
      isArticle(page.route, pages, site) && metadata.date ? `${longDate(metadata.date)}. ` : "";
    const detail = metadata.role ? `${metadata.role}, ${metadata.period}. ` : dated;
    return `- ${linkTo(metadata.title, resolve(page.route))}: ${detail}${(metadata.description ?? "").replace(/\s+/g, " ")}`;
  };
  const home = pages.filter((page) => page.route === "/").slice(0, 1);
  const topLevel = pages.filter(
    (page) =>
      page.route !== "/" &&
      !page.index &&
      !isNotFound(page.route) &&
      parentRoute(page.route) === "/",
  );
  const writing = topLevel
    .filter((page) => isArticle(page.route, pages, site))
    .sort(newestFirstByTitle);
  const standalone = topLevel.filter((page) => !isArticle(page.route, pages, site)).sort(byRoute);
  const collections = pages
    .filter((page) => page.index)
    .sort(byRoute)
    .map((collection) => ({
      collection,
      entries: pages
        .filter((page) => !page.index && parentRoute(page.route) === collection.route)
        .sort(newestFirstByTitle),
    }));
  const elsewhere = (site.navigation ?? []).filter((item) => /^https?:\/\//.test(item.href));
  const sections = [
    `## Pages\n\n${[...home, ...standalone].map(describe).join("\n")}`,
    writing.length > 0 ? `## Writing\n\n${writing.map(describe).join("\n")}` : "",
    ...collections.map(
      ({ collection, entries }) =>
        `## ${collection.metadata.title}\n\n${[collection, ...entries].map(describe).join("\n")}`,
    ),
    elsewhere.length > 0
      ? `## Elsewhere\n\n${elsewhere.map((item) => `- ${linkTo(item.label, item.href)}: ${linkTo("llms.txt", new URL("/llms.txt", item.href).href)}`).join("\n")}`
      : "",
  ];
  const origin = site.url;
  return `# ${site.brand}\n\n> ${site.description}\n\nEvery page on ${new URL(origin).host} is also published as Markdown: add \`.md\` to the page path, for example ${origin}/some-page.md for ${origin}/some-page/. The homepage is ${origin}/index.md. The links below point at those Markdown versions.\n\n${sections.filter(Boolean).join("\n\n")}\n`;
}
