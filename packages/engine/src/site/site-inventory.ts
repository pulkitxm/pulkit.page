import { lstatSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import profile from "@pulkit/profile";
import { developmentOutput } from "@pulkit/shared/built-site";
import { walkFiles } from "@pulkit/shared/files";
import { siteConfigFile } from "@pulkit/shared/frontmatter";
import { themeFile } from "@pulkit/theme/files";
import { loadLayouts } from "../render/layouts.ts";
import { projectListKey, projectsDirective } from "../render/projects.ts";
import { articles } from "../seo/routes.ts";
import type { ListedPage, Page, ProjectList, Site, SiteInventory } from "../types.ts";
import { fetchProjectList } from "./github-projects.ts";
import { readFrontmatter, readPage, siteSettings } from "./read-page.ts";

const externalList = /^:::list ([a-z0-9-]+):all\b/gm;

export function readSiteConfig(url: string, root = "."): Site {
  const config = siteSettings(
    readFrontmatter(readFileSync(join(root, siteConfigFile), "utf8")).data,
  );
  return {
    author: profile.name,
    authorUrl: profile.url,
    ...config,
    ...(config.wordmark && {
      wordmark: readFileSync(themeFile(config.wordmark), "utf8").trim(),
    }),
    social: [
      ...(config.social ?? profile.social),
      ...(config.articles ? [{ label: "RSS", href: "/feed.xml" }] : []),
    ],
    url,
  };
}

function pageSources(root: string, content: string): string[] {
  return walkFiles(content).filter((path) => {
    if (lstatSync(path).isSymbolicLink()) {
      throw new Error(`Symlinks are not supported in page trees: ${path}`);
    }
    if (/\.mdx$/i.test(path)) {
      throw new Error(`MDX is not supported; use Markdown: ${path}`);
    }
    return /\.md$/i.test(path) && path !== join(root, siteConfigFile);
  });
}

export function readPages(root: string): Page[] {
  const content = join(root, "content");
  const routes = new Set<string>();
  const pages = pageSources(root, content)
    .sort((left, right) => Number(left > right) - Number(left < right))
    .map((source): Page => {
      const name = relative(content, source).replace(/\.md$/i, "");
      const route = name === "home" || name === "index" ? "/" : `/${name.replace(/\/index$/, "")}/`;
      const key = route.normalize("NFC").toLowerCase();
      if (routes.has(key)) {
        throw new Error(`Multiple Markdown sources map to ${route}`);
      }
      if (developmentOutput.test(route.split("/")[1] ?? "")) {
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

function readExternalArticles(name: string): ListedPage[] {
  const sites: Readonly<Record<string, string>> = profile.sites;
  const origin = Object.hasOwn(sites, name) ? sites[name] : undefined;
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

async function readProjectLists(pages: readonly Page[]): Promise<Record<string, ProjectList>> {
  const origins = Object.values(profile.sites).map((site) => new URL(site).origin);
  const keys = new Set(
    pages.flatMap((page) =>
      [...page.body.matchAll(new RegExp(projectsDirective, "gm"))].map(
        ([, login = "", slug = ""]) => projectListKey(login, slug),
      ),
    ),
  );
  const lists = await Promise.all(
    [...keys].map(async (key): Promise<[string, ProjectList]> => {
      const [login = "", slug = ""] = key.split("/");
      return [key, await fetchProjectList(login, slug, origins)];
    }),
  );
  return Object.fromEntries(lists);
}

export async function readSite(url: string): Promise<SiteInventory> {
  const pages = readPages(".");
  const names = new Set(
    pages.flatMap((page) =>
      [...page.body.matchAll(externalList)].flatMap((match) => (match[1] ? [match[1]] : [])),
    ),
  );
  return {
    pages,
    layouts: loadLayouts(),
    site: {
      ...readSiteConfig(url),
      external: Object.fromEntries([...names].map((name) => [name, readExternalArticles(name)])),
      projects: await readProjectLists(pages),
    },
  };
}
