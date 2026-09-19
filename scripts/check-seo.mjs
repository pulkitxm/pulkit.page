import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { escapeHtml, readPage } from "./render-page.mjs";
import { imagePath, pageTitle } from "./seo.mjs";
import { resolveSiteOrigin } from "./site-origin.mjs";

export function validateSeo(html, route, metadata, site, readAsset) {
  const require = (condition, message) => {
    if (!condition) {
      throw new Error(`${route}: ${message}`);
    }
  };
  const url = site.url + route;
  const canonical = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/g)];
  require(canonical.length === 1 &&
    canonical[0][1] === url, "canonical must match the configured route");
  require((html.match(/<h1[\s>]/g) ?? []).length === 1, "expected exactly one H1");
  require((html.match(/<main[\s>]/g) ?? []).length === 1, "expected exactly one main landmark");
  require(html.includes(
    `<title>${escapeHtml(pageTitle(metadata, site, route))}</title>`,
  ), "incorrect title");
  const metas = new Map();
  for (const match of html.matchAll(/<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"/g)) {
    require(!metas.has(match[1]), `duplicate metadata: ${match[1]}`);
    metas.set(match[1], match[2]);
  }
  for (const [key, value] of Object.entries({
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
    robots: "index, follow, max-image-preview:large",
  })) {
    require(metas.get(key) === escapeHtml(value), `incorrect ${key}`);
  }
  const scripts = [
    ...html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/g),
  ];
  require(scripts.length === 1, "expected one JSON-LD graph");
  const graph = JSON.parse(scripts[0][1]);
  require(graph["@context"] === "https://schema.org", "invalid schema context");
  const entities = graph["@graph"];
  const ids = entities.map((entry) => entry["@id"]);
  require(new Set(ids).size === ids.length, "duplicate entity identifiers");
  const page = entities.find((entry) => entry["@id"] === `${url}#webpage`);
  require(page?.url === url &&
    page.name === metadata.title, "page entity does not match canonical");
  require(page.isPartOf["@id"] === `${site.url}/#website`, "page disconnected from website");
  const post = entities.find((entry) => entry["@type"] === "BlogPosting");
  if (post) {
    require(post.datePublished === metadata.date &&
      post.headline === metadata.title, "incorrect article facts");
    require(!post.dateModified &&
      post.author["@id"] === `${site.url}/#person`, "unsupported article date or author");
  }
  const png = readAsset(imagePath(route));
  require(png
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "invalid PNG signature");
  require(png.readUInt32BE(16) === 1200 &&
    png.readUInt32BE(20) === 630, "incorrect image dimensions");
}
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}
function checkSeo(root = "dist") {
  const site = {
    ...readPage(readFileSync("content/_site.md", "utf8")).metadata,
    url: resolveSiteOrigin(),
  };
  const titles = new Set();
  const descriptions = new Set();
  const routes = [];
  for (const file of walk("content").filter(
    (path) => path.endsWith(".md") && path !== "content/_site.md",
  )) {
    const { metadata } = readPage(readFileSync(file, "utf8"));
    const route =
      file === "content/home.md" ? "/" : `/${file.slice(8).replace(/(?:\/index)?\.md$/, "")}/`;
    routes.push(route);
    if (titles.has(metadata.title) || descriptions.has(metadata.description)) {
      throw new Error(`${file}: duplicate title or description`);
    }
    titles.add(metadata.title);
    descriptions.add(metadata.description);
    const html = readFileSync(join(root, route, "index.html"), "utf8");
    validateSeo(html, route, metadata, site, (path) => readFileSync(join(root, path)));
    for (const match of html.matchAll(/href="(https?:\/\/[^"#]+)(?:#[^"]*)?"/g)) {
      const target = new URL(match[1]);
      if (
        target.origin === site.url &&
        !existsSync(join(root, target.pathname, "index.html")) &&
        !existsSync(join(root, target.pathname))
      ) {
        throw new Error(`${file}: unresolved canonical link ${target.href}`);
      }
    }
  }
  const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (
    JSON.stringify(locations.toSorted((a, b) => a.localeCompare(b))) !==
    JSON.stringify(routes.map((route) => site.url + route).toSorted((a, b) => a.localeCompare(b)))
  ) {
    throw new Error("Sitemap must contain every canonical page exactly once");
  }
  if (
    !readFileSync(join(root, "robots.txt"), "utf8").includes(`Sitemap: ${site.url}/sitemap.xml`)
  ) {
    throw new Error("Robots must advertise the canonical sitemap");
  }
  console.log(`Validated SEO, JSON-LD, sitemap and PNG dimensions for ${routes.length} pages`);
}
if (import.meta.main) {
  checkSeo();
}
