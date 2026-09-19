import { lstatSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import profile from "@pulkit/profile";
import { developmentOutput } from "@pulkit/shared/built-site";
import { walkFiles } from "@pulkit/shared/files";
import { siteConfigFile } from "@pulkit/shared/frontmatter";
import { loadLayouts } from "./layouts.mjs";
import { readPage } from "./render-page.mjs";
import { articles } from "./seo.mjs";

const externalList = /^:::list ([a-z0-9-]+):all\b/gm;

export function readSiteConfig(url, root = ".") {
  const config = readPage(readFileSync(join(root, siteConfigFile), "utf8")).metadata;
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

function readPages(root) {
  const content = join(root, "content");
  function sources(directory) {
    return walkFiles(directory).filter((path) => {
      if (lstatSync(path).isSymbolicLink()) {
        throw new Error(`Symlinks are not supported in page trees: ${path}`);
      }
      if (/\.mdx$/i.test(path)) {
        throw new Error(`MDX is not supported; use Markdown: ${path}`);
      }
      return /\.md$/i.test(path) && path !== join(root, siteConfigFile);
    });
  }
  const routes = new Set();
  const pages = sources(content)
    .sort((left, right) => Number(left > right) - Number(left < right))
    .map((source) => {
      const name = relative(content, source).replace(/\.md$/i, "");
      const route = name === "home" || name === "index" ? "/" : `/${name.replace(/\/index$/, "")}/`;
      const key = route.normalize("NFC").toLowerCase();
      if (routes.has(key)) {
        throw new Error(`Multiple Markdown sources map to ${route}`);
      }
      if (developmentOutput.test(route.split("/")[1])) {
        throw new Error("Root dev-<port> routes are reserved for development output");
      }
      routes.add(key);
      const text = readFileSync(source, "utf8");
      return { source, text, ...readPage(text), route, index: source.endsWith("/index.md") };
    });
  if (!routes.has("/")) {
    throw new Error("Missing homepage source: content/home.md");
  }
  return pages;
}

function readExternalArticles(name) {
  const origin = profile.sites[name];
  if (!origin) {
    throw new Error(`Unknown site in list directive: ${name}`);
  }
  const root = join("..", name);
  const pages = readPages(root);
  return articles(pages, readSiteConfig(origin, root)).map((page) => ({
    route: origin + page.route,
    metadata: page.metadata,
  }));
}

export function readSite(url) {
  const pages = readPages(".");
  const names = new Set(
    pages.flatMap((page) => [...page.body.matchAll(externalList)].map((match) => match[1])),
  );
  return {
    pages,
    layouts: loadLayouts(),
    site: {
      ...readSiteConfig(url),
      external: Object.fromEntries([...names].map((name) => [name, readExternalArticles(name)])),
    },
  };
}
