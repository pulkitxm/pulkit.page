import { escapeXml as xml } from "@pulkit/shared/html";
import { themeFile } from "@pulkit/theme/files";
import { Resvg } from "@resvg/resvg-js";
import type { GenerationCache } from "../lib/generation-cache.ts";
import type { ListedPage, Site, SiteContext } from "../types.ts";
import { categoryOf, imagePath, isArticle } from "./routes.ts";

export function titleLines(title: string, width = 29): string[] {
  const lines: string[] = [];
  for (const word of title.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + word.length + 1 <= width) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

export function cardCategory(
  page: ListedPage,
  pages: readonly ListedPage[],
  site: SiteContext,
): string {
  if (page.index) {
    return page.metadata.title;
  }
  return (
    categoryOf(page.route, pages)?.metadata.title ??
    (isArticle(page.route, pages, site) || page.route === site.articles ? "Writing" : "Portfolio")
  );
}

export function renderCard(page: ListedPage, site: Site, category: string): Buffer {
  const lines = titleLines(page.metadata.title);
  const size = lines.length > 4 ? 44 : 54;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0b0b0b"/><g fill="#f2f2ef" font-family="IBM Plex Mono"><text x="72" y="96" font-size="26">${xml(site.brand)} / ${category}</text><path d="M72 135H1128" stroke="#414141"/>${lines.map((line, index) => `<text x="72" y="${225 + index * 64}" font-size="${size}">${xml(line)}</text>`).join("")}<text x="72" y="565" font-size="22" fill="#aaa">${xml(new URL(site.url).host)}</text><text x="1128" y="565" text-anchor="end" font-size="22" fill="#aaa">${xml(page.metadata.period ?? page.metadata.date ?? "Software engineer")}</text></g></svg>`;
  return new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: [themeFile("assets/fonts/ibm-plex-mono-regular.ttf")],
      defaultFontFamily: "IBM Plex Mono",
    },
  })
    .render()
    .asPng();
}

export function cardOutputs(
  pages: readonly ListedPage[],
  site: Site,
  cache: GenerationCache,
): Map<string, Buffer> {
  const output = new Map<string, Buffer>();
  for (const page of pages) {
    const category = cardCategory(page, pages, site);
    const encoded = cache.get(
      "card",
      [
        page.route,
        page.metadata.title,
        page.metadata.description,
        page.metadata.date,
        page.metadata.period,
        site.brand,
        site.url,
        category,
      ],
      () => renderCard(page, site, category).toString("base64"),
    );
    output.set(imagePath(page.route).slice(1), Buffer.from(encoded, "base64"));
  }
  return output;
}
