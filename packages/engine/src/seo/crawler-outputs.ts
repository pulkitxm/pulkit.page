import { escapeXml as xml } from "@pulkit/shared/html";
import type { ListedPage, Site } from "../types.ts";
import { articles, isArticle } from "./routes.ts";

function timestamp(date: string | undefined): string {
  return `${date}T00:00:00Z`;
}

function atomFeed(pages: readonly ListedPage[], site: Site): string {
  const entries = articles(pages, site).sort((a, b) =>
    (b.metadata.date ?? "").localeCompare(a.metadata.date ?? ""),
  );
  const updated = timestamp(entries[0] ? entries[0].metadata.date : "2000-01-01");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xml(site.brand)}</title>
  <subtitle>${xml(site.description)}</subtitle>
  <id>${xml(`${site.url}/`)}</id>
  <link href="${xml(`${site.url}/`)}" />
  <link rel="self" href="${xml(`${site.url}/feed.xml`)}" />
  <updated>${updated}</updated>
  <author><name>${xml(site.author ?? site.brand)}</name><uri>${xml(site.authorUrl ?? `${site.url}/`)}</uri></author>
${entries
  .map(
    (page) => `  <entry>
    <title>${xml(page.metadata.title)}</title>
    <id>${xml(site.url + page.route)}</id>
    <link href="${xml(site.url + page.route)}" />
    <published>${timestamp(page.metadata.date)}</published>
    <updated>${timestamp(page.metadata.date)}</updated>
    <summary>${xml(page.metadata.description)}</summary>
  </entry>`,
  )
  .join("\n")}
</feed>
`;
}

function sitemap(pages: readonly ListedPage[], site: Site): string {
  const urls = pages.map(
    (page) =>
      `  <url><loc>${xml(site.url + page.route)}</loc>${isArticle(page.route, pages, site) && page.metadata.date ? `<lastmod>${page.metadata.date}</lastmod>` : ""}</url>`,
  );
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function crawlerOutputs(pages: readonly ListedPage[], site: Site): Map<string, Buffer> {
  const output = new Map<string, Buffer>();
  output.set("sitemap.xml", Buffer.from(sitemap(pages, site)));
  if (site.articles) {
    output.set("feed.xml", Buffer.from(atomFeed(pages, site)));
  }
  output.set(
    "robots.txt",
    Buffer.from(`User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`),
  );
  return output;
}
