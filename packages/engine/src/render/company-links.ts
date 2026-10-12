import { readFileSync } from "node:fs";
import { escapeHtml } from "@pulkit/shared/html";
import { safeUrl } from "./html.ts";

const icons = {
  world: import.meta.resolve("@tabler/icons/outline/world.svg"),
  linkedin: import.meta.resolve("@tabler/icons/outline/brand-linkedin.svg"),
  x: import.meta.resolve("@tabler/icons/outline/brand-x.svg"),
  github: import.meta.resolve("@tabler/icons/outline/brand-github.svg"),
  instagram: import.meta.resolve("@tabler/icons/outline/brand-instagram.svg"),
  youtube: import.meta.resolve("@tabler/icons/outline/brand-youtube.svg"),
};

type IconName = keyof typeof icons;

const platformIcons: Record<string, IconName> = {
  "linkedin.com": "linkedin",
  "x.com": "x",
  "twitter.com": "x",
  "github.com": "github",
  "instagram.com": "instagram",
  "youtube.com": "youtube",
};

const iconCache = new Map<IconName, string>();

function iconSvg(name: IconName): string {
  let svg = iconCache.get(name);
  if (svg === undefined) {
    svg = readFileSync(new URL(icons[name]), "utf8")
      .replace(/\s+/g, " ")
      .replace(/ class="[^"]*"/, ' class="size-4.5" aria-hidden="true"')
      .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none" \/>/, "")
      .replace(/>\s+</g, "><")
      .trim();
    iconCache.set(name, svg);
  }
  return svg;
}

function linkLabel(href: string): string {
  const url = new URL(href);
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
}

function linkIcon(href: string): string {
  const host = new URL(href).hostname.replace(/^(?:www|m)\./, "");
  return iconSvg(platformIcons[host] ?? "world");
}

export function companyLinks(links: readonly string[] | undefined): string {
  if (!links?.length) {
    return "";
  }
  return `<ul class="mt-0 mb-6 flex list-none flex-wrap items-center gap-3.5 p-0">${links
    .map((href) => {
      if (!href.startsWith("https://")) {
        throw new Error(`Company links must use https: ${href}`);
      }
      const label = escapeHtml(linkLabel(href));
      return `<li class="flex"><a class="flex text-muted transition-colors duration-150 hover:text-fg" href="${safeUrl(href)}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${linkIcon(href)}</a></li>`;
    })
    .join("")}</ul>`;
}
