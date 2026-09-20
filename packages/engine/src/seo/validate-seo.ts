import { escapeHtml } from "@pulkit/shared/html";
import { isRecord } from "../lib/guards.ts";
import type { PageMetadata, Site } from "../types.ts";
import { imagePath, pageTitle } from "./routes.ts";
import { robots } from "./seo-head.ts";

type ReadAsset = (path: string) => Buffer;

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function idOf(value: unknown): unknown {
  return isRecord(value) ? value["@id"] : undefined;
}

function graphEntities(json: string): { context: unknown; entities: Record<string, unknown>[] } {
  const graph: unknown = JSON.parse(json);
  if (!isRecord(graph)) {
    return { context: undefined, entities: [] };
  }
  const entities = graph["@graph"];
  return {
    context: graph["@context"],
    entities: Array.isArray(entities) ? entities.filter(isRecord) : [],
  };
}

function expectedMetadata(
  route: string,
  metadata: PageMetadata,
  site: Site,
): Record<string, string | undefined> {
  const url = site.url + route;
  return {
    description: metadata.description,
    "og:description": metadata.description,
    "twitter:description": metadata.description,
    "og:url": url,
    "og:title": pageTitle(metadata, site, route),
    "twitter:title": pageTitle(metadata, site, route),
    "og:image": site.url + imagePath(route),
    "twitter:image": site.url + imagePath(route),
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:type": "image/png",
    "og:image:alt": metadata.title,
    "twitter:image:alt": metadata.title,
    "twitter:card": "summary_large_image",
    robots: robots(route),
  };
}

export function validateSeo(
  html: string,
  route: string,
  metadata: PageMetadata,
  site: Site,
  readAsset: ReadAsset,
): void {
  const require = (condition: unknown, message: string): void => {
    if (!condition) {
      throw new Error(`${route}: ${message}`);
    }
  };
  const url = site.url + route;
  const canonical = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/g)];
  require(canonical.length === 1 &&
    canonical[0]?.[1] === url, "canonical must match the configured route");
  require((html.match(/<h1[\s>]/g) ?? []).length === 1, "expected exactly one H1");
  require((html.match(/<main[\s>]/g) ?? []).length === 1, "expected exactly one main landmark");
  require(html.includes(
    `<title>${escapeHtml(pageTitle(metadata, site, route))}</title>`,
  ), "incorrect title");
  const metas = new Map<string, string>();
  for (const [, key = "", value = ""] of html.matchAll(
    /<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"(?!\s+media=)/g,
  )) {
    require(!metas.has(key), `duplicate metadata: ${key}`);
    metas.set(key, value);
  }
  for (const [key, value] of Object.entries(expectedMetadata(route, metadata, site))) {
    require(metas.get(key) === escapeHtml(value), `incorrect ${key}`);
  }
  const scripts = [
    ...html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/g),
  ];
  require(scripts.length === 1, "expected one JSON-LD graph");
  const { context, entities } = graphEntities(scripts[0]?.[1] ?? "");
  require(context === "https://schema.org", "invalid schema context");
  const ids = entities.map((entry) => entry["@id"]);
  require(new Set(ids).size === ids.length, "duplicate entity identifiers");
  const page = entities.find((entry) => entry["@id"] === `${url}#webpage`);
  require(page?.url === url &&
    page.name === metadata.title, "page entity does not match canonical");
  require(idOf(page?.isPartOf) === `${site.url}/#website`, "page disconnected from website");
  const post = entities.find((entry) => entry["@type"] === "BlogPosting");
  if (post) {
    require(post.datePublished === metadata.date &&
      post.headline === metadata.title, "incorrect article facts");
    require(!post.dateModified &&
      idOf(post.author) === `${site.url}/#person`, "unsupported article date or author");
  }
  const png = readAsset(imagePath(route));
  require(png.subarray(0, 8).equals(pngSignature), "invalid PNG signature");
  require(png.readUInt32BE(16) === 1200 &&
    png.readUInt32BE(20) === 630, "incorrect image dimensions");
}
