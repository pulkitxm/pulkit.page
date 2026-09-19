import { longDate } from "../render/html.ts";
import { markdownPath } from "../seo/routes.ts";
import type { ListedPage, Site } from "../types.ts";

export type ResolveUrl = (url: string) => string;

function label(text: string): string {
  return text.replace(/[\\[\]]/g, "\\$&");
}

function destination(url: string): string {
  return /[\s()<>]/.test(url) ? `<${url.replace(/>/g, "%3E")}>` : url;
}

export function linkTo(text: string, url: string): string {
  return `[${label(text)}](${destination(url)})`;
}

export function imageTo(alt: string, url: string): string {
  return `![${label(alt)}](${destination(url)})`;
}

export function quote(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

export function markdownResolver(pages: readonly ListedPage[], site: Site): ResolveUrl {
  const routes = new Set(pages.map((page) => page.route));
  return (url) => {
    if (!url.startsWith("/") || url.startsWith("//")) {
      return url;
    }
    const [, path = "", suffix = ""] = /^([^?#]*)(.*)$/.exec(url) ?? [];
    return routes.has(path) ? `${site.url}${markdownPath(path)}${suffix}` : `${site.url}${url}`;
  };
}

export function entryLine(page: ListedPage, resolve: ResolveUrl): string {
  const { metadata } = page;
  const dated = metadata.date ? longDate(metadata.date) : "";
  const detail = metadata.role
    ? [metadata.role, metadata.period].filter(Boolean).join(", ")
    : dated;
  const href = /^https?:\/\//.test(page.route)
    ? page.route.replace(/\/$/, ".md")
    : resolve(page.route);
  return `- ${linkTo(metadata.title, href)}${detail ? `: ${detail}` : ""}`;
}
