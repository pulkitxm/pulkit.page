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
  bluesky: import.meta.resolve("@tabler/icons/outline/brand-bluesky.svg"),
  mastodon: import.meta.resolve("@tabler/icons/outline/brand-mastodon.svg"),
  reddit: import.meta.resolve("@tabler/icons/outline/brand-reddit.svg"),
  twitch: import.meta.resolve("@tabler/icons/outline/brand-twitch.svg"),
  npm: import.meta.resolve("@tabler/icons/outline/brand-npm.svg"),
  threads: import.meta.resolve("@tabler/icons/outline/brand-threads.svg"),
  medium: import.meta.resolve("@tabler/icons/outline/brand-medium.svg"),
  stackoverflow: import.meta.resolve("@tabler/icons/outline/brand-stackoverflow.svg"),
  dribbble: import.meta.resolve("@tabler/icons/outline/brand-dribbble.svg"),
  behance: import.meta.resolve("@tabler/icons/outline/brand-behance.svg"),
};

type IconName = keyof typeof icons;

const platformIcons: Record<string, IconName> = {
  "linkedin.com": "linkedin",
  "x.com": "x",
  "twitter.com": "x",
  "github.com": "github",
  "instagram.com": "instagram",
  "youtube.com": "youtube",
  "bsky.app": "bluesky",
  "mastodon.social": "mastodon",
  "reddit.com": "reddit",
  "twitch.tv": "twitch",
  "npmjs.com": "npm",
  "threads.net": "threads",
  "medium.com": "medium",
  "stackoverflow.com": "stackoverflow",
  "dribbble.com": "dribbble",
  "behance.net": "behance",
};

const iconCache = new Map<string, string>();

function iconSvg(name: IconName, size: string): string {
  const key = `${name} ${size}`;
  let svg = iconCache.get(key);
  if (svg === undefined) {
    svg = readFileSync(new URL(icons[name]), "utf8")
      .replace(/\s+/g, " ")
      .replace(/ class="[^"]*"/, ` class="${size}" aria-hidden="true"`)
      .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none" \/>/, "")
      .replace(/>\s+</g, "><")
      .trim();
    iconCache.set(key, svg);
  }
  return svg;
}

export function linkLabel(href: string): string {
  const url = new URL(href);
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
}

export function linkIcon(href: string, size = "size-4.5"): string {
  const host = new URL(href).hostname.replace(/^(?:www|m)\./, "");
  return iconSvg(platformIcons[host] ?? "world", size);
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
