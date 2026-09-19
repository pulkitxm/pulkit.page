import { escapeHtml } from "@pulkit/shared/html";
import type { ListedPage, PageMetadata, Site } from "../types.ts";
import { imagePath, isArticle, markdownPath, pageTitle } from "./routes.ts";
import { safeJson, structuredData } from "./structured-data.ts";

type MetaEntry = readonly [string, string | undefined];

function meta(name: string, content: string | undefined, property = false): string {
  return `<meta ${property ? "property" : "name"}="${name}" content="${escapeHtml(content)}" />`;
}

export function seoHead(
  route: string,
  metadata: PageMetadata,
  site: Site,
  pages: readonly ListedPage[],
): string {
  const url = site.url + route;
  const image = site.url + imagePath(route);
  const article = isArticle(route, pages, site);
  const openGraph: MetaEntry[] = [
    ["og:type", article ? "article" : "website"],
    ["og:site_name", site.brand],
    ["og:locale", "en_US"],
    ["og:title", pageTitle(metadata, site, route)],
    ["og:description", metadata.description],
    ["og:url", url],
    ["og:image", image],
    ["og:image:secure_url", image],
    ["og:image:type", "image/png"],
    ["og:image:width", "1200"],
    ["og:image:height", "630"],
    ["og:image:alt", metadata.title],
  ];
  const twitter: MetaEntry[] = [
    ["twitter:card", "summary_large_image"],
    ["twitter:title", pageTitle(metadata, site, route)],
    ["twitter:description", metadata.description],
    ["twitter:image", image],
    ["twitter:image:alt", metadata.title],
  ];
  return `<link rel="canonical" href="${escapeHtml(url)}" />
<link rel="alternate" type="text/markdown" href="${escapeHtml(site.url + markdownPath(route))}" />
${meta("robots", "index, follow, max-image-preview:large")}
${openGraph.map(([key, value]) => meta(key, value, true)).join("\n")}
${article && metadata.date ? meta("article:published_time", metadata.date, true) + meta("article:author", site.authorUrl ?? `${site.url}/`, true) : ""}
${twitter.map(([key, value]) => meta(key, value)).join("\n")}
<script type="application/ld+json">${safeJson(structuredData(route, metadata, site, pages))}</script>`;
}
