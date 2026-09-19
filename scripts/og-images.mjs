import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { markdownOutputs } from "./markdown-export.mjs";
import { imagePath } from "./seo.mjs";

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
export function renderCard(page, site) {
  const lines = titleLines(page.metadata.title);
  const size = lines.length > 4 ? 44 : 54;
  const category = page.route.startsWith("/blogs/")
    ? "Writing"
    : page.route.startsWith("/exp/")
      ? "Experience"
      : "Portfolio";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0b0b0b"/><g fill="#f2f2ef" font-family="IBM Plex Mono"><text x="72" y="96" font-size="26">${xml(site.brand)} / ${category}</text><path d="M72 135H1128" stroke="#414141"/>${lines.map((line, index) => `<text x="72" y="${225 + index * 64}" font-size="${size}">${xml(line)}</text>`).join("")}<text x="72" y="565" font-size="22" fill="#aaa">${xml(new URL(site.url).host)}</text><text x="1128" y="565" text-anchor="end" font-size="22" fill="#aaa">${xml(page.metadata.period ?? page.metadata.date ?? "Software engineer")}</text></g></svg>`;
  return new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: [resolve("assets/fonts/ibm-plex-mono-regular.ttf")],
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
            ],
            () => renderCard(page, site).toString("base64"),
          ),
          "base64",
        )
      : renderCard(page, site);
    output.set(`pages${imagePath(page.route)}`, bytes);
  }
  return new Map([...output, ...crawlerOutputs(pages, site), ...markdownOutputs(pages, site)]);
}
export function crawlerOutputs(pages, site) {
  const output = new Map();
  output.set(
    "pages/sitemap.xml",
    Buffer.from(
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${xml(site.url + page.route)}</loc></url>`).join("\n")}\n</urlset>\n`,
    ),
  );
  output.set(
    "pages/robots.txt",
    Buffer.from(`User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`),
  );
  return output;
}
