import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { builtRoutes } from "@pulkit/shared/built-site";

export interface Site {
  name: string;
  directory: string;
  domain: string;
}

export function discoverSites(filters: readonly string[]): Site[] {
  return readdirSync("apps", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join("apps", entry.name, "CNAME")))
    .map((entry) => {
      const directory = join("apps", entry.name);
      const domain = readFileSync(join(directory, "CNAME"), "utf8").trim();
      return { name: entry.name, directory, domain };
    })
    .filter(
      (site) =>
        filters.length === 0 || filters.includes(site.name) || filters.includes(site.domain),
    );
}

export async function sitemapRoutes(origin: string): Promise<string[]> {
  const response = await fetch(new URL("/sitemap.xml", origin));
  if (!response.ok) {
    throw new Error(`Could not fetch ${response.url}: HTTP ${response.status}`);
  }
  const text = await response.text();
  return [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map(([, location]) => new URL(location ?? ""))
    .filter((url) => url.origin === new URL(origin).origin)
    .map((url) => url.pathname);
}

export function localRoutes(site: Site): string[] {
  if (!existsSync(join(site.directory, "dist/index.html"))) {
    throw new Error(
      `No build found for ${site.domain}. Run \`bun run build\` first, or pass --prod.`,
    );
  }
  return builtRoutes(join(site.directory, "dist"));
}
