import { Resvg } from "@resvg/resvg-js";
import { markdownOutputs } from "./markdown-export.mjs";
import { articles, categoryOf, imagePath, isArticle } from "./seo.mjs";
import { themeFile } from "./theme-files.mjs";

const xml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character],
  );
export function titleLines(title, width = 29) {
  const lines = [];
  for (const word of title.split(/\s+/)) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + word.length + 1 <= width) {
      lines[last] += ` ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}
export function cardCategory(page, pages, site) {
  if (page.index) {
    return page.metadata.title;
  }
  return (
    categoryOf(page.route, pages)?.metadata.title ??
    (isArticle(page.route, pages, site) || page.route === site.articles ? "Writing" : "Portfolio")
  );
}
export function renderCard(page, site, category) {
  const lines = titleLines(page.metadata.title);
  const size = lines.length > 4 ? 44 : 54;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0b0b0b"/><g fill="#f2f2ef" font-family="IBM Plex Mono"><text x="72" y="96" font-size="26">${xml(site.brand)} / ${category}</text><path d="M72 135H1128" stroke="#414141"/>${lines.map((line, index) => `<text x="72" y="${225 + index * 64}" font-size="${size}">${xml(line)}</text>`).join("")}<text x="72" y="565" font-size="22" fill="#aaa">${xml(new URL(site.url).host)}</text><text x="1128" y="565" text-anchor="end" font-size="22" fill="#aaa">${xml(page.metadata.period ?? page.metadata.date ?? "Software engineer")}</text></g></svg>`;
  return new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: [themeFile("fonts/ibm-plex-mono-regular.ttf")],
      defaultFontFamily: "IBM Plex Mono",
    },
  })
    .render()
    .asPng();
}
export function seoOutputs(pages, site, cache) {
  const output = new Map();
  for (const page of pages) {
    const bytes = cache
      ? Buffer.from(
          cache.get(
            "card",
            [
              page.route,
              page.metadata.title,
              page.metadata.description,
              page.metadata.date,
              page.metadata.period,
              site.brand,
              site.url,
              cardCategory(page, pages, site),
            ],
            () => renderCard(page, site, cardCategory(page, pages, site)).toString("base64"),
          ),
          "base64",
        )
      : renderCard(page, site, cardCategory(page, pages, site));
    output.set(imagePath(page.route).slice(1), bytes);
  }
  return new Map([...output, ...crawlerOutputs(pages, site), ...markdownOutputs(pages, site)]);
}
export function crawlerOutputs(pages, site) {
  const output = new Map();
  output.set(
    "sitemap.xml",
    Buffer.from(
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${xml(site.url + page.route)}</loc>${isArticle(page.route, pages, site) && page.metadata.date ? `<lastmod>${page.metadata.date}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`,
    ),
  );
  if (site.articles) {
    output.set("feed.xml", Buffer.from(atomFeed(pages, site)));
  }
  output.set(
    "robots.txt",
    Buffer.from(`User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`),
  );
  return output;
}
function atomFeed(pages, site) {
  const entries = articles(pages, site).sort((a, b) =>
    b.metadata.date.localeCompare(a.metadata.date),
  );
  const timestamp = (date) => `${date}T00:00:00Z`;
  const updated = entries[0] ? timestamp(entries[0].metadata.date) : timestamp("2000-01-01");
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
