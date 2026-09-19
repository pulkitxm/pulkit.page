import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import profile from "@pulkit/profile";
import { loadLayouts } from "./layouts.mjs";
import { readPage } from "./render-page.mjs";

export function readSiteConfig(url) {
  const config = readPage(readFileSync("content/_site.md", "utf8")).metadata;
  return {
    author: profile.name,
    authorUrl: profile.url,
    ...config,
    social: [
      ...(config.social ?? profile.social),
      ...(config.articles ? [{ label: "RSS", href: "/feed.xml" }] : []),
    ],
    url,
  };
}

export function readSite(url) {
  function sources(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symlinks are not supported in page trees: ${path}`);
      }
      if (entry.isDirectory()) {
        return sources(path);
      }
      if (/\.mdx$/i.test(path)) {
        throw new Error(`MDX is not supported; use Markdown: ${path}`);
      }
      return /\.md$/i.test(path) && path !== "content/_site.md" ? [path] : [];
    });
  }
  const routes = new Set();
  const pages = sources("content")
    .sort()
    .map((source) => {
      const name = relative("content", source).replace(/\.md$/i, "");
      const route = name === "home" || name === "index" ? "/" : `/${name.replace(/\/index$/, "")}/`;
      const key = route.normalize("NFC").toLowerCase();
      if (routes.has(key)) {
        throw new Error(`Multiple Markdown sources map to ${route}`);
      }
      if (/^\/dev-[0-9]+\//.test(route)) {
        throw new Error("Root dev-<port> routes are reserved for development output");
      }
      routes.add(key);
      const text = readFileSync(source, "utf8");
      return { source, text, ...readPage(text), route, index: source.endsWith("/index.md") };
    });
  if (!routes.has("/")) {
    throw new Error("Missing homepage source: content/home.md");
  }
  return {
    pages,
    layouts: loadLayouts(),
    site: readSiteConfig(url),
  };
}
